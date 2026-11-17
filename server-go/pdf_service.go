package main

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/jung-kurt/gofpdf"
)

type SessionPedagogicaData struct {
	Titulo                 string   `json:"titulo"`
	NumeroSesion           string   `json:"numeroSesion"`
	Institucion            string   `json:"institucion"`
	Docente                string   `json:"docente"`
	Area                   string   `json:"area"`
	Grado                  string   `json:"grado"`
	Seccion                string   `json:"seccion"`
	Duracion               int      `json:"duracion"`
	Fecha                  string   `json:"fecha"`
	Competencia            string   `json:"competencia"`
	Capacidades            []string `json:"capacidades"`
	Desempenos            string   `json:"desempenos"`
	Evidencia              string   `json:"evidencia"`
	InstrumentoEvaluacion  string   `json:"instrumentoEvaluacion"`
	CompetenciaTransversal string   `json:"competenciaTransversal"`
	EnfoqueTransversal     string   `json:"enfoqueTransversal"`
	ActitudesEnfoque       string   `json:"actitudesEnfoque"`
	SecuenciaInicio        string   `json:"secuenciaInicio"`
	TiempoInicio           int      `json:"tiempoInicio"`
	SecuenciaDesarrollo    string   `json:"secuenciaDesarrollo"`
	TiempoDesarrollo       int      `json:"tiempoDesarrollo"`
	SecuenciaCierre        string   `json:"secuenciaCierre"`
	TiempoCierre           int      `json:"tiempoCierre"`
	RecursosMateriales     string   `json:"recursosMateriales"`
}

func GenerateSessionPDF(data *SessionPedagogicaData) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	tr := pdf.UnicodeTranslatorFromDescriptor("")

	// Header
	pdf.SetFont("Helvetica", "B", 14)
	pdf.SetTextColor(0, 74, 198) // Sapphire Blue
	title := fmt.Sprintf("SESIÓN PEDAGÓGICA CNEB: %s", data.Titulo)
	pdf.MultiCell(180, 6, tr(title), "", "L", false)
	pdf.Ln(2)

	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(115, 118, 134)
	sub := fmt.Sprintf("Plantilla Oficial de Matriz Curricular • %s (%s)", data.Area, data.Grado)
	pdf.CellFormat(180, 5, tr(sub), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// Section 1: Datos informativos
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(0, 74, 198)
	pdf.CellFormat(180, 6, tr("I. DATOS INFORMATIVOS"), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	pdf.SetFillColor(244, 246, 255)
	pdf.SetDrawColor(225, 228, 242)
	pdf.SetTextColor(19, 27, 46)
	pdf.SetFont("Helvetica", "", 9)

	colW := 45.0
	rowH := 7.0

	drawInfoCell := func(label, val string) {
		pdf.CellFormat(colW, rowH, tr(fmt.Sprintf("%s %s", label, val)), "1", 0, "L", true, 0, "")
	}

	drawInfoCell("I.E.:", data.Institucion)
	drawInfoCell("Docente:", data.Docente)
	drawInfoCell("Grado/Sec:", fmt.Sprintf("%s \"%s\"", data.Grado, data.Seccion))
	drawInfoCell("Duración:", fmt.Sprintf("%d min", data.Duracion))
	pdf.Ln(rowH + 5)

	// Section 2: Propositos de aprendizaje
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(0, 74, 198)
	pdf.CellFormat(180, 6, tr("II. PROPÓSITOS DE APRENDIZAJE"), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	pdf.SetFillColor(234, 237, 255)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(0, 74, 198)
	pdf.CellFormat(60, 7, tr("Competencias y Capacidades"), "1", 0, "L", true, 0, "")
	pdf.CellFormat(60, 7, tr("Desempeños Precisados"), "1", 0, "L", true, 0, "")
	pdf.CellFormat(60, 7, tr("Criterios y Evidencias"), "1", 1, "L", true, 0, "")

	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(19, 27, 46)

	caps := strings.Join(data.Capacidades, "\n• ")
	if caps != "" {
		caps = "• " + caps
	}
	compText := fmt.Sprintf("%s\n\nCapacidades:\n%s", data.Competencia, caps)
	critText := fmt.Sprintf("Evidencia:\n%s\n\nInstrumento:\n%s", data.Evidencia, data.InstrumentoEvaluacion)

	// Draw multi-line row
	yBefore := pdf.GetY()
	pdf.Rect(15, yBefore, 60, 40, "D")
	pdf.Rect(75, yBefore, 60, 40, "D")
	pdf.Rect(135, yBefore, 60, 40, "D")

	pdf.SetXY(15, yBefore)
	pdf.MultiCell(60, 4.5, tr(compText), "", "L", false)
	pdf.SetXY(75, yBefore)
	pdf.MultiCell(60, 4.5, tr(data.Desempenos), "", "L", false)
	pdf.SetXY(135, yBefore)
	pdf.MultiCell(60, 4.5, tr(critText), "", "L", false)

	pdf.SetY(yBefore + 42)

	// Section 3: Secuencia didactica
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(0, 74, 198)
	pdf.CellFormat(180, 6, tr("III. SECUENCIA DIDÁCTICA (MOMENTOS PEDAGÓGICOS)"), "", 1, "L", false, 0, "")
	pdf.Ln(2)

	renderMomento := func(nombre string, tiempo int, texto string) {
		pdf.SetFillColor(244, 246, 255)
		pdf.SetFont("Helvetica", "B", 9)
		pdf.SetTextColor(0, 74, 198)
		pdf.CellFormat(140, 6, tr(nombre), "1", 0, "L", true, 0, "")
		pdf.CellFormat(40, 6, tr(fmt.Sprintf("%d min", tiempo)), "1", 1, "C", true, 0, "")

		pdf.SetFont("Helvetica", "", 8.5)
		pdf.SetTextColor(19, 27, 46)
		pdf.MultiCell(180, 4.5, tr(texto), "1", "L", false)
		pdf.Ln(2)
	}

	renderMomento("1. INICIO (Motivación, Saberes Previos, Conflicto Cognitivo)", data.TiempoInicio, data.SecuenciaInicio)
	renderMomento("2. DESARROLLO (Gestión, Acompañamiento, Construcción)", data.TiempoDesarrollo, data.SecuenciaDesarrollo)
	renderMomento("3. CIERRE (Metacognición, Evaluación y Transferencia)", data.TiempoCierre, data.SecuenciaCierre)

	// Section 4: Recursos
	pdf.Ln(2)
	pdf.SetFont("Helvetica", "B", 11)
	pdf.SetTextColor(0, 74, 198)
	pdf.CellFormat(180, 6, tr("IV. RECURSOS Y MATERIALES"), "", 1, "L", false, 0, "")
	pdf.Ln(1)
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(19, 27, 46)
	pdf.MultiCell(180, 5, tr(data.RecursosMateriales), "1", "L", false)

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
