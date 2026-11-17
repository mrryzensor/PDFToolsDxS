package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type GeminiContent struct {
	Role  string       `json:"role"`
	Parts []GeminiPart `json:"parts"`
}

type GeminiPart struct {
	Text string `json:"text"`
}

type GeminiRequest struct {
	Contents          []GeminiContent   `json:"contents"`
	SystemInstruction *GeminiContent    `json:"systemInstruction,omitempty"`
	GenerationConfig  map[string]interface{} `json:"generationConfig,omitempty"`
}

type GeminiCandidate struct {
	Content struct {
		Parts []GeminiPart `json:"parts"`
	} `json:"content"`
}

type GeminiResponse struct {
	Candidates []GeminiCandidate `json:"candidates"`
	Error      *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

func CallGeminiWithKeys(apiKeys []string, models []string, systemPrompt, userPrompt string, asJSON bool) (string, string, error) {
	if len(apiKeys) == 0 {
		return "", "", fmt.Errorf("no hay claves de Gemini configuradas")
	}

	// Default active models in priority order
	models = []string{
		"gemini-3.5-flash-lite",
		"gemini-3.5-flash",
		"gemini-flash-lite-latest",
		"gemini-flash-latest",
	}

	reqBody := GeminiRequest{
		Contents: []GeminiContent{
			{Role: "user", Parts: []GeminiPart{{Text: userPrompt}}},
		},
		GenerationConfig: map[string]interface{}{
			"temperature": 0.4,
		},
	}

	if systemPrompt != "" {
		reqBody.SystemInstruction = &GeminiContent{
			Parts: []GeminiPart{{Text: systemPrompt}},
		}
	}
	if asJSON {
		reqBody.GenerationConfig["responseMimeType"] = "application/json"
	}

	reqBytes, _ := json.Marshal(reqBody)
	client := &http.Client{Timeout: 60 * time.Second}

	var lastErr error
	// Double Failover: Iterates through each API Key, and for each key, iterates models
	for _, apiKey := range apiKeys {
		k := strings.TrimSpace(apiKey)
		if k == "" {
			continue
		}

		for _, m := range models {
			url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", m, k)
			resp, err := client.Post(url, "application/json", strings.NewReader(string(reqBytes)))
			if err != nil {
				lastErr = err
				continue
			}

			var gemResp GeminiResponse
			_ = json.NewDecoder(resp.Body).Decode(&gemResp)
			resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				msg := "error desconocido"
				if gemResp.Error != nil {
					msg = gemResp.Error.Message
				}
				lastErr = fmt.Errorf("HTTP %d: %s", resp.StatusCode, msg)
				// If key is invalid (401, 403), break model loop and switch to NEXT API KEY immediately
				if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
					break
				}
				continue
			}

			if len(gemResp.Candidates) > 0 && len(gemResp.Candidates[0].Content.Parts) > 0 {
				return gemResp.Candidates[0].Content.Parts[0].Text, m, nil
			}
		}
	}

	return "", "", fmt.Errorf("fallaron todas las claves/modelos de Gemini: %w", lastErr)
}

func CallGemini(apiKey string, models []string, systemPrompt, userPrompt string, asJSON bool) (string, string, error) {
	return CallGeminiWithKeys([]string{apiKey}, models, systemPrompt, userPrompt, asJSON)
}
