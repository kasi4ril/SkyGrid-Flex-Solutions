package handlers

import (
	"bytes"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// WebRenderer manages modular Go html/template parsing, page rendering, and static asset delivery.
type WebRenderer struct {
	templateDir string
	staticDir   string
	devMode     bool
	mu          sync.RWMutex
	templates   map[string]*template.Template
}

// NewWebRenderer initializes the template manager and compiles templates.
func NewWebRenderer(templateDir, staticDir string, devMode bool) (*WebRenderer, error) {
	// Auto-resolve directories if relative paths are used
	if _, err := os.Stat(templateDir); os.IsNotExist(err) {
		if _, err := os.Stat(filepath.Join("core-backend", templateDir)); err == nil {
			templateDir = filepath.Join("core-backend", templateDir)
		}
	}
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		if _, err := os.Stat(filepath.Join("core-backend", staticDir)); err == nil {
			staticDir = filepath.Join("core-backend", staticDir)
		}
	}

	wr := &WebRenderer{
		templateDir: templateDir,
		staticDir:   staticDir,
		devMode:     devMode,
		templates:   make(map[string]*template.Template),
	}

	if err := wr.compileTemplates(); err != nil {
		return nil, fmt.Errorf("initial template compilation failed: %w", err)
	}

	// Pre-generate static/index.html to ensure offline and static file servers stay 100% in sync
	if err := wr.syncStaticIndex(); err != nil {
		log.Printf("[WARN] WebRenderer failed to pre-generate static/index.html: %v", err)
	} else {
		log.Printf("[BOOT] WebRenderer synced static/index.html from modular templates")
	}

	return wr, nil
}

// compileTemplates scans and parses base, partials, modals, and page templates.
func (wr *WebRenderer) compileTemplates() error {
	baseFile := filepath.Join(wr.templateDir, "base.html")
	if _, err := os.Stat(baseFile); err != nil {
		return fmt.Errorf("base template missing at %s: %w", baseFile, err)
	}

	partials, err := filepath.Glob(filepath.Join(wr.templateDir, "partials", "*.html"))
	if err != nil {
		return fmt.Errorf("failed to scan partials: %w", err)
	}
	modals, err := filepath.Glob(filepath.Join(wr.templateDir, "modals", "*.html"))
	if err != nil {
		return fmt.Errorf("failed to scan modals: %w", err)
	}

	allComponents := []string{baseFile}
	allComponents = append(allComponents, partials...)
	allComponents = append(allComponents, modals...)

	baseTmpl, err := template.ParseFiles(allComponents...)
	if err != nil {
		return fmt.Errorf("error parsing component templates: %w", err)
	}

	pages, err := filepath.Glob(filepath.Join(wr.templateDir, "pages", "*.html"))
	if err != nil {
		return fmt.Errorf("failed to scan pages: %w", err)
	}

	newTemplates := make(map[string]*template.Template)
	for _, pagePath := range pages {
		pageName := filepath.Base(pagePath) // e.g. "index.html", "about.html"
		clone, err := baseTmpl.Clone()
		if err != nil {
			return fmt.Errorf("failed to clone base template for %s: %w", pageName, err)
		}
		pageTmpl, err := clone.ParseFiles(pagePath)
		if err != nil {
			return fmt.Errorf("failed to parse page template %s: %w", pageName, err)
		}
		newTemplates[pageName] = pageTmpl
	}

	wr.mu.Lock()
	wr.templates = newTemplates
	wr.mu.Unlock()

	return nil
}

// syncStaticIndex renders the index page and writes it to staticDir/index.html
func (wr *WebRenderer) syncStaticIndex() error {
	wr.mu.RLock()
	tmpl, exists := wr.templates["index.html"]
	wr.mu.RUnlock()

	if !exists {
		return fmt.Errorf("index.html template not compiled")
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "base", map[string]any{"Title": "SkyGrid Solutions"}); err != nil {
		return err
	}

	indexPath := filepath.Join(wr.staticDir, "index.html")
	return os.WriteFile(indexPath, buf.Bytes(), 0644)
}

// RenderPage renders the specified page template into the HTTP response.
func (wr *WebRenderer) RenderPage(w http.ResponseWriter, r *http.Request, pageName string, data any) {
	if wr.devMode {
		if err := wr.compileTemplates(); err != nil {
			log.Printf("[ERROR] Dynamic template re-compile failed: %v", err)
			http.Error(w, fmt.Sprintf("Template compilation error: %v", err), http.StatusInternalServerError)
			return
		}
	}

	wr.mu.RLock()
	tmpl, exists := wr.templates[pageName]
	wr.mu.RUnlock()

	if !exists {
		http.NotFound(w, r)
		return
	}

	var buf bytes.Buffer
	if err := tmpl.ExecuteTemplate(&buf, "base", data); err != nil {
		log.Printf("[ERROR] Template execution error for %s: %v", pageName, err)
		http.Error(w, fmt.Sprintf("Template execution error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buf.Bytes())
}

// RegisterRoutes hooks up template routes and static file handlers.
func (wr *WebRenderer) RegisterRoutes(mux *http.ServeMux) {
	// 1. Static asset paths
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(wr.staticDir))))
	mux.Handle("/css/", http.StripPrefix("/css/", http.FileServer(http.Dir(filepath.Join(wr.staticDir, "css")))))
	mux.Handle("/js/", http.StripPrefix("/js/", http.FileServer(http.Dir(filepath.Join(wr.staticDir, "js")))))

	// 2. Specific modular pages
	dedicatedPages := map[string]string{
		"/about":           "about.html",
		"/about.html":      "about.html",
		"/contact":         "contact.html",
		"/contact.html":    "contact.html",
		"/packages":        "packages.html",
		"/packages.html":   "packages.html",
		"/calculator":      "calculator.html",
		"/calculator.html": "calculator.html",
	}

	for route, page := range dedicatedPages {
		p := page
		mux.HandleFunc(route, func(w http.ResponseWriter, r *http.Request) {
			wr.RenderPage(w, r, p, map[string]any{
				"Title": strings.Title(strings.TrimSuffix(p, ".html")),
				"Path":  r.URL.Path,
			})
		})
	}

	// 3. Root and catch-all handler
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Check if a physical static file exists in staticDir (e.g. favicon.ico, images)
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			filePath := filepath.Join(wr.staticDir, filepath.Clean(r.URL.Path))
			if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
				http.ServeFile(w, r, filePath)
				return
			}
		}

		// Default to full modular index page
		wr.RenderPage(w, r, "index.html", map[string]any{
			"Title": "SkyGrid Solutions",
			"Path":  r.URL.Path,
		})
	})
}
