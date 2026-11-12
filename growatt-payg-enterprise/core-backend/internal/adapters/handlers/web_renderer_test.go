package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWebRendererModularRoutes(t *testing.T) {
	templateDir := "../../../templates"
	staticDir := "../../../static"

	wr, err := NewWebRenderer(templateDir, staticDir, true)
	if err != nil {
		t.Fatalf("Failed to initialize WebRenderer: %v", err)
	}

	mux := http.NewServeMux()
	wr.RegisterRoutes(mux)

	tests := []struct {
		name           string
		path           string
		expectedStatus int
		containsText   string
	}{
		{
			name:           "Home Root",
			path:           "/",
			expectedStatus: http.StatusOK,
			containsText:   "SkyGrid Solutions",
		},
		{
			name:           "Home Index HTML",
			path:           "/index.html",
			expectedStatus: http.StatusOK,
			containsText:   "Power Your Life",
		},
		{
			name:           "About Page",
			path:           "/about",
			expectedStatus: http.StatusOK,
			containsText:   "African Mission",
		},
		{
			name:           "Contact Page",
			path:           "/contact",
			expectedStatus: http.StatusOK,
			containsText:   "Connect with Our Clean Energy Architects",
		},
		{
			name:           "Packages Page",
			path:           "/packages",
			expectedStatus: http.StatusOK,
			containsText:   "Essential Home",
		},
		{
			name:           "Calculator Page",
			path:           "/calculator",
			expectedStatus: http.StatusOK,
			containsText:   "Affordability &amp; Fuel Savings Calculator",
		},
		{
			name:           "CSS Stylesheet",
			path:           "/static/css/styles.css",
			expectedStatus: http.StatusOK,
			containsText:   "--brand-forest",
		},
		{
			name:           "JS Application Bundle",
			path:           "/static/js/app.js",
			expectedStatus: http.StatusOK,
			containsText:   "HERO_SLIDES",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			if rec.Code != tc.expectedStatus {
				t.Errorf("Path %s: expected status %d, got %d", tc.path, tc.expectedStatus, rec.Code)
			}

			body := rec.Body.String()
			if !strings.Contains(body, tc.containsText) {
				t.Errorf("Path %s: expected body to contain %q, but was not found (len: %d)", tc.path, tc.containsText, len(body))
			}
		})
	}
}
