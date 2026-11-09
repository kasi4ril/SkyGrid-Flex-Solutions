// Package notifications provides email and SMS delivery adapters for 2FA, OTPs, and alerts.
package notifications

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// DispatchedMessage records an outbound email or SMS for auditing and verification.
type DispatchedMessage struct {
	Type      string    `json:"type"` // EMAIL or SMS
	Recipient string    `json:"recipient"`
	Subject   string    `json:"subject,omitempty"`
	Body      string    `json:"body"`
	SentAt    time.Time `json:"sent_at"`
}

// NotificationDispatcher defines operations for delivering outbound notifications.
type NotificationDispatcher interface {
	SendEmail(ctx context.Context, toEmail, subject, htmlBody, plainText string) error
	SendSMS(ctx context.Context, toPhone, message string) error
	GetRecentDispatches() []DispatchedMessage
}

// UnifiedNotifier provides multi-channel logging and delivery with in-memory audit history.
type UnifiedNotifier struct {
	mu        sync.RWMutex
	history   []DispatchedMessage
	maxStored int
}

// NewUnifiedNotifier constructs a unified notification dispatcher.
func NewUnifiedNotifier() *UnifiedNotifier {
	return &UnifiedNotifier{
		history:   make([]DispatchedMessage, 0, 100),
		maxStored: 100,
	}
}

// SendEmail logs and records an outgoing email message.
func (n *UnifiedNotifier) SendEmail(ctx context.Context, toEmail, subject, htmlBody, plainText string) error {
	toEmail = strings.TrimSpace(toEmail)
	msg := DispatchedMessage{
		Type:      "EMAIL",
		Recipient: toEmail,
		Subject:   subject,
		Body:      plainText,
		SentAt:    time.Now().UTC(),
	}

	n.mu.Lock()
	if len(n.history) >= n.maxStored {
		n.history = n.history[1:]
	}
	n.history = append(n.history, msg)
	n.mu.Unlock()

	log.Printf("[NOTIFICATION-EMAIL] To: %s | Subject: %s | Body: %s", toEmail, subject, plainText)
	return nil
}

// SendSMS logs and records an outgoing SMS message.
func (n *UnifiedNotifier) SendSMS(ctx context.Context, toPhone, message string) error {
	toPhone = strings.TrimSpace(toPhone)
	msg := DispatchedMessage{
		Type:      "SMS",
		Recipient: toPhone,
		Body:      message,
		SentAt:    time.Now().UTC(),
	}

	n.mu.Lock()
	if len(n.history) >= n.maxStored {
		n.history = n.history[1:]
	}
	n.history = append(n.history, msg)
	n.mu.Unlock()

	log.Printf("[NOTIFICATION-SMS] To: %s | Message: %s", toPhone, message)
	return nil
}

// GetRecentDispatches returns a snapshot copy of recently dispatched notifications.
func (n *UnifiedNotifier) GetRecentDispatches() []DispatchedMessage {
	n.mu.RLock()
	defer n.mu.RUnlock()
	res := make([]DispatchedMessage, len(n.history))
	copy(res, n.history)
	return res
}

// MaskEmail masks an email for secure presentation (e.g. e***o@skygrid.ng).
func MaskEmail(email string) string {
	parts := strings.Split(strings.TrimSpace(email), "@")
	if len(parts) != 2 {
		return email
	}
	name := parts[0]
	domain := parts[1]
	if len(name) <= 2 {
		return name + "***@" + domain
	}
	return string(name[0]) + "***" + string(name[len(name)-1]) + "@" + domain
}

// MaskPhone masks a phone number for secure presentation (e.g. +234 803 *** **67).
func MaskPhone(phone string) string {
	clean := strings.TrimSpace(phone)
	if len(clean) < 8 {
		return clean
	}
	prefix := clean[:min(len(clean), 7)]
	suffix := clean[len(clean)-2:]
	return fmt.Sprintf("%s *** **%s", prefix, suffix)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
