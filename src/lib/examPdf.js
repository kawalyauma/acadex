/**
 * examPdf.js — Premium Academic PDF Generator
 * Uganda PLE | Streamlined & Professional Report Card
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JsBarcode from 'jsbarcode'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  ink:       '#0D1117',
  inkSoft:   '#1F2937',
  slate:     '#4B5563',
  muted:     '#9CA3AF',
  rule:      '#E5E7EB',
  surface:   '#F9FAFB',
  white:     '#FFFFFF',
  headerBg:  '#0D1117',
  accent:    '#1D4ED8',
  accentBg:  '#EFF6FF',
  D1: '#047857', D2: '#059669',
  C3: '#1D4ED8', C4: '#2563EB', C5: '#3B82F6', C6: '#60A5FA',
  P7: '#B45309', P8: '#D97706',
  F9: '#B91C1C', NG: '#6B7280',
  div1: '#047857', div2: '#1D4ED8', div3: '#6D28D9', div4: '#B45309', divU: '#B91C1C',
}

function h2r(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}
const rgb  = (hex) => h2r(hex)
const setFill = (doc, hex) => doc.setFillColor(...rgb(hex))
const setDraw = (doc, hex) => doc.setDrawColor(...rgb(hex))
const setTxt  = (doc, hex) => doc.setTextColor(...rgb(hex))
const font    = (doc, style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size) }

// ── Grade helpers ─────────────────────────────────────────────────────────────
function gradeColor(grade, bands = []) {
  const band = bands.find(b => b.grade === grade)
  if (band?.color_hex) return band.color_hex
  return C[grade] || C.NG
}

function aggToDivision(agg) {
  if (agg == null) return { label: 'Ungraded', color: C.divU, range: '—' }
  if (agg <= 12)   return { label: 'Division I',   color: C.div1, range: '4–12'  }
  if (agg <= 23)   return { label: 'Division II',  color: C.div2, range: '13–23' }
  if (agg <= 29)   return { label: 'Division III', color: C.div3, range: '24–29' }
  if (agg <= 34)   return { label: 'Division IV',  color: C.div4, range: '30–34' }
  return { label: 'Ungraded', color: C.divU, range: '35+' }
}

// ── Barcode (Professional Styling) ────────────────────────────────────────────
function barcodeImg(text) {
  try {
    const c = document.createElement('canvas')
    JsBarcode(c, String(text || '0'), {
      format: 'CODE128', width: 1.5, height: 28,
      displayValue: false, margin: 0, background: '#ffffff', lineColor: '#0D1117',
    })
    return c.toDataURL('image/png')
  } catch { return null }
}

// ── Page chrome ───────────────────────────────────────────────────────────────
function drawPageBg(doc) {
  setFill(doc, C.white); doc.rect(0, 0, 210, 297, 'F')
}

function drawHeader(doc, schoolName, examLabel) {
  const W = 210

  // Top accent bar
  setFill(doc, C.accent)
  doc.rect(0, 0, W, 3, 'F')

  // School name
  font(doc, 'bold', 13); setTxt(doc, C.ink)
  doc.text(schoolName || 'LUBOWA MEMORIAL JUNIOR SCHOOL', W / 2, 10, { align: 'center' })

  // Contact line — all on one row
  font(doc, 'normal', 5.5); setTxt(doc, C.slate)
  doc.text(
    'Mpongo, Gomba - Uganda  ·  Tel: 0701069595 / 0782408202  ·  www.lubowamemorial.com',
    W / 2, 15, { align: 'center' }
  )

  // Divider
  setDraw(doc, C.rule); doc.setLineWidth(0.2)
  doc.line(10, 18, W - 10, 18)

  // TRANSCRIPT label — left
  font(doc, 'bold', 5.5); setTxt(doc, C.muted)
  doc.text('OFFICIAL ACADEMIC TRANSCRIPT', 13, 23)

  // Exam label — center
  font(doc, 'bold', 7); setTxt(doc, C.ink)
  doc.text((examLabel || 'Report Card').toUpperCase(), W / 2, 23, { align: 'center' })

  // CONFIDENTIAL — right
  font(doc, 'bold', 5.5); setTxt(doc, C.accent)
  doc.text('CONFIDENTIAL', W - 13, 23, { align: 'right' })

  // Bottom rule
  setDraw(doc, C.accent); doc.setLineWidth(0.4)
  doc.line(10, 26, W - 10, 26)

  return 31
}
function drawStudentPanel(doc, card, y) {
  const H = 32

  setFill(doc, C.surface)
  doc.roundedRect(10, y, 190, H, 2, 2, 'F')
  setDraw(doc, C.rule); doc.setLineWidth(0.2)
  doc.roundedRect(10, y, 190, H, 2, 2, 'S')

  setFill(doc, C.accent)
  doc.rect(10, y, 3, H, 'F')

  font(doc, 'bold', 13); setTxt(doc, C.ink)
  const fullName = `${card.first_name || ''} ${card.last_name || ''}`.trim() || '—'
  doc.text(fullName, 17, y + 10)

  font(doc, 'normal', 7.5); setTxt(doc, C.slate)
  const subtitle = [
    card.class_name,
    card.stream_name,
    card.academic_year_name,
    card.term_name,
  ].filter(Boolean).join('  ·  ')
  doc.text(subtitle, 17, y + 17)

  setDraw(doc, C.rule); doc.setLineWidth(0.2)
  doc.line(17, y + 19.5, 193, y + 19.5)

  const bc = barcodeImg(card.student_number || card.student_id)
  if (bc) {
    doc.addImage(bc, 'PNG', 152, y + 2, 36, 10)
    font(doc, 'normal', 5); setTxt(doc, C.muted)
    doc.text(String(card.student_number || ''), 170, y + 14, { align: 'center' })
  }

  const meta = [
    ['ADM NO', card.student_number || '—'],
    ['CLASS',  `${card.class_name || '—'}${card.stream_name ? ' · ' + card.stream_name : ''}`],
    ['EXAM',   card.exam_name || '—'],
    ['TERM',   card.term_name || '—'],
  ]

  let mx = 17
  meta.forEach(([lbl, val]) => {
    font(doc, 'bold', 5); setTxt(doc, C.muted)
    doc.text(lbl, mx, y + 24)
    font(doc, 'bold', 7); setTxt(doc, C.ink)
    doc.text(String(val).substring(0, 22), mx, y + 29.5)
    mx += 44
  })

  return y + H + 4
}

function drawResultSummary(doc, card, bands, y) {
  const agg     = card.aggregate
  const divInfo = aggToDivision(agg)

  const H  = 16
  const by = y

  setDraw(doc, divInfo.color); doc.setLineWidth(0.4)
  doc.roundedRect(10, by, 190, H, 2, 2, 'S')

  setFill(doc, divInfo.color)
  doc.roundedRect(10, by, 4, H, 2, 2, 'F')
  doc.rect(12, by, 2, H, 'F')

  font(doc, 'bold', 6); setTxt(doc, C.muted)
  doc.text('AGGREGATE', 18, by + 5.5)
  font(doc, 'bold', 10); setTxt(doc, divInfo.color)
  doc.text(agg != null ? String(agg) : '—', 18, by + 13)

  setDraw(doc, C.rule); doc.setLineWidth(0.2)
  doc.line(48, by + 2, 48, by + H - 2)

  font(doc, 'bold', 6); setTxt(doc, C.muted)
  doc.text('DIVISION', 53, by + 5.5)
  font(doc, 'bold', 10); setTxt(doc, divInfo.color)
  doc.text(divInfo.label.toUpperCase(), 53, by + 13)

  doc.line(122, by + 2, 122, by + H - 2)

  font(doc, 'bold', 6); setTxt(doc, C.muted)
  doc.text('Next term commence', 127, by + 5.5)
  font(doc, 'bold', 10); setTxt(doc, C.ink)
  doc.text('18th may 2026', 127, by + 13)

  return by + H + 4
}

function drawMarksTable(doc, marks, y, bands) {
  if (!marks?.length) return y

  function getRemark(mark, grade, isAbsent, isExempt) {
    if (isAbsent) return 'Absent'
    if (isExempt) return 'Exempted'
    if (mark == null) return ''
    if (mark >= 80) return 'Excellent'
    if (mark >= 70) return 'Very Good'
    if (mark >= 60) return 'Good'
    if (mark >= 50) return 'Fair'
    if (mark >= 40) return 'Needs Improvement'
    return 'Poor'
  }

  font(doc, 'bold', 7); setTxt(doc, C.muted)
  doc.text('SUBJECT PERFORMANCE', 10, y + 4)
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.line(10, y + 6, 200, y + 6)

  autoTable(doc, {
    startY: y + 8,
    head: [['#', 'Subject', 'Score', 'Grade', 'Remarks']],
    body: marks.map((m, i) => {
      const score = m.is_absent ? 'ABSENT' : m.is_exempt ? 'EXEMPT' : (m.marks_obtained ?? '—')
      const grade = m.grade || (m.is_gradable ? '—' : 'NG')
      return [
        i + 1,
        m.subject_name || '—',
        score,
        grade,
        m.remarks || getRemark(m.marks_obtained, grade, m.is_absent, m.is_exempt),
      ]
    }),

    headStyles: {
      fillColor: rgb(C.ink),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
    },

    bodyStyles: {
      fontSize: 8,
      textColor: rgb(C.inkSoft),
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      valign: 'middle',
    },

    columnStyles: {
      0: { cellWidth: 7,  halign: 'center', textColor: rgb(C.muted), fontSize: 7 },
      1: { cellWidth: 72, fontStyle: 'bold', fontSize: 8.5 },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 47, textColor: rgb(C.muted), fontStyle: 'italic', fontSize: 7 },
    },

    didParseCell(data) {
      if (data.section === 'body') {
        const raw = data.cell.raw

        if (data.column.index === 3) {
          const gc = gradeColor(raw, bands)
          if (gc) {
            data.cell.styles.textColor = rgb(gc)
            const [r, g, b] = rgb(gc)
            data.cell.styles.fillColor = [
              Math.min(255, r + 220),
              Math.min(255, g + 220),
              Math.min(255, b + 220),
            ]
          }
        }

        if (data.column.index === 2) {
          if (raw === 'ABSENT') {
            data.cell.styles.textColor = rgb(C.F9)
            data.cell.styles.fontStyle = 'bold'
          }
          if (raw === 'EXEMPT') {
            data.cell.styles.textColor = rgb(C.slate)
            data.cell.styles.fontStyle = 'italic'
          }
        }

        if (data.column.index === 2 && typeof raw === 'number') {
          const scoreColor = raw >= 80 ? C.div1 : raw >= 60 ? C.div2 : raw >= 50 ? C.div4 : raw >= 40 ? C.P8 : C.F9
          data.cell.styles.textColor = rgb(scoreColor)
        }
      }

      if (data.section === 'head') {
        if (data.column.index === 1) data.cell.styles.halign = 'left'
      }
    },

    alternateRowStyles: { fillColor: rgb(C.surface) },
    styles: { lineColor: rgb(C.rule), lineWidth: 0.1, overflow: 'ellipsize' },
    margin: { left: 10, right: 10 },
  })

  return doc.lastAutoTable.finalY + 4
}

function drawAttendanceSummary(doc, attendanceData, y, card) {
  if (!attendanceData) return y

  const s      = attendanceData.summary || attendanceData
  const total  = s.total_days   ?? s.total   ?? 0
  const absent = s.absent_days  ?? s.absent  ?? 0
  const rate   = s.attendance_percent ?? s.attendance_rate ??
    (total > 0 ? Math.round((total - absent) / total * 100) : 0)

  const rateColor = rate >= 90 ? C.div1 : rate >= 75 ? C.div2 : rate >= 60 ? C.div4 : C.divU
  const agg = card?.aggregate ?? null

  function scoreToRating(score) {
    if (score >= 85) return { label: 'Excellent', color: C.div1 }
    if (score >= 70) return { label: 'Very Good',  color: C.div2 }
    if (score >= 55) return { label: 'Good',       color: C.C4  }
    if (score >= 40) return { label: 'Fair',       color: C.div4 }
    return                  { label: 'Poor',       color: C.divU }
  }

  const particulars = [
    { name: 'Punctuality',    score: rate >= 95 ? 90 : rate >= 90 ? 78 : rate >= 80 ? 62 : rate >= 70 ? 48 : rate >= 60 ? 35 : 20 },
    { name: 'Attendance',     score: rate >= 95 ? 95 : rate >= 90 ? 82 : rate >= 80 ? 68 : rate >= 70 ? 52 : rate >= 60 ? 38 : 22 },
    { name: 'Academic Effort',score: agg == null ? 60 : agg <= 8 ? 95 : agg <= 12 ? 85 : agg <= 18 ? 74 : agg <= 23 ? 62 : agg <= 29 ? 48 : agg <= 34 ? 35 : 20 },
    { name: 'Neatness',       score: Math.round((rate >= 90 ? 80 : rate >= 75 ? 68 : rate >= 60 ? 54 : 38) * 0.5 + (agg == null ? 60 : agg <= 12 ? 85 : agg <= 23 ? 70 : agg <= 29 ? 55 : agg <= 34 ? 42 : 28) * 0.5) },
    { name: 'Responsibility', score: Math.round((rate >= 90 ? 85 : rate >= 75 ? 70 : rate >= 60 ? 55 : 35) * 0.6 + (agg == null ? 60 : agg <= 12 ? 88 : agg <= 23 ? 72 : agg <= 29 ? 56 : agg <= 34 ? 40 : 25) * 0.4) },
    { name: 'Co-operation',   score: Math.round((rate >= 90 ? 82 : rate >= 75 ? 68 : rate >= 60 ? 52 : 36) * 0.5 + (agg == null ? 60 : agg <= 12 ? 84 : agg <= 23 ? 70 : agg <= 29 ? 55 : agg <= 34 ? 42 : 28) * 0.5) },
  ]

  font(doc, 'bold', 7); setTxt(doc, C.muted)
  doc.text('ATTENDANCE & CONDUCT', 10, y + 4)
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.line(10, y + 6, 200, y + 6)

  const sectionY = y + 9
  const sectionH = 50

  // ── LEFT: Attendance ──────────────────────────────────
  setFill(doc, C.surface)
  doc.roundedRect(10, sectionY, 88, sectionH, 2, 2, 'F')
  setDraw(doc, C.rule); doc.setLineWidth(0.15)
  doc.roundedRect(10, sectionY, 88, sectionH, 2, 2, 'S')

  const cx = 30, cy = sectionY + 20, r = 13, stroke = 3

  setDraw(doc, C.rule); doc.setLineWidth(stroke)
  doc.circle(cx, cy, r, 'S')

  if (rate > 0) {
    setDraw(doc, rateColor); doc.setLineWidth(stroke)
    const steps = 64
    const startAngle = -Math.PI / 2
    const endAngle   = startAngle + (2 * Math.PI * rate / 100)
    for (let i = 0; i < steps; i++) {
      const a0 = startAngle + (endAngle - startAngle) * (i / steps)
      const a1 = startAngle + (endAngle - startAngle) * ((i + 1) / steps)
      doc.line(
        cx + r * Math.cos(a0), cy + r * Math.sin(a0),
        cx + r * Math.cos(a1), cy + r * Math.sin(a1)
      )
    }
  }

  font(doc, 'bold', 9); setTxt(doc, rateColor)
  doc.text(`${rate}%`, cx, cy + 1.5, { align: 'center' })
  font(doc, 'normal', 6); setTxt(doc, C.muted)
  doc.text('rate', cx, cy + 7, { align: 'center' })

  const sx = cx + r + 8
  font(doc, 'bold', 20); setTxt(doc, C.divU)
  doc.text(String(absent), sx, cy + 3)
  font(doc, 'normal', 6.5); setTxt(doc, C.muted)
  doc.text('days absent', sx, cy + 9)

  font(doc, 'bold', 11); setTxt(doc, C.ink)
  doc.text('80', sx, cy + 20)
  font(doc, 'normal', 6); setTxt(doc, C.muted)
  doc.text('total school days', sx, cy + 25.5)

  // ── RIGHT: Conduct ────────────────────────────────────
  const condX = 104, condW = 96

  setFill(doc, C.surface)
  doc.roundedRect(condX, sectionY, condW, sectionH, 2, 2, 'F')
  setDraw(doc, C.rule); doc.setLineWidth(0.15)
  doc.roundedRect(condX, sectionY, condW, sectionH, 2, 2, 'S')

  setFill(doc, C.ink)
  doc.roundedRect(condX, sectionY, condW, 9, 2, 2, 'F')
  doc.rect(condX, sectionY + 5, condW, 4, 'F')
  font(doc, 'bold', 7); setTxt(doc, C.white)
  doc.text('CONDUCT & CHARACTER ASSESSMENT', condX + condW / 2, sectionY + 6.5, { align: 'center' })

  const col1X   = condX + 4
  const col2X   = condX + 50
  const headerY = sectionY + 14

  font(doc, 'bold', 6); setTxt(doc, C.muted)
  doc.text('PARTICULAR', col1X, headerY)
  doc.text('RATING', col2X, headerY)

  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.line(condX + 2, headerY + 2, condX + condW - 2, headerY + 2)

  const rowH = 6
  let   rowY = headerY + 6

  particulars.forEach((p, i) => {
    const rating       = scoreToRating(p.score)
    const [rr, rg, rb] = h2r(rating.color)

    if (i % 2 === 0) {
      setFill(doc, '#F3F4F6')
      doc.rect(condX + 1, rowY - 4, condW - 2, rowH, 'F')
    }

    font(doc, 'bold', 6.5); setTxt(doc, C.inkSoft)
    doc.text(p.name, col1X, rowY)

    const labelW = 24, labelH = 4.5, labelX = col2X, labelY = rowY - 3.5
    setFill(doc, `#${Math.min(255, rr + 195).toString(16).padStart(2, '0')}${Math.min(255, rg + 195).toString(16).padStart(2, '0')}${Math.min(255, rb + 195).toString(16).padStart(2, '0')}`)
    doc.roundedRect(labelX, labelY, labelW, labelH, 1, 1, 'F')
    setDraw(doc, rating.color); doc.setLineWidth(0.2)
    doc.roundedRect(labelX, labelY, labelW, labelH, 1, 1, 'S')

    font(doc, 'bold', 6); setTxt(doc, rating.color)
    doc.text(rating.label, labelX + labelW / 2, rowY - 0.5, { align: 'center' })

    const barX = col2X + 27, barY = rowY - 3.2, barW = 26, barH = 3
    setFill(doc, C.rule)
    doc.roundedRect(barX, barY, barW, barH, 0.5, 0.5, 'F')
    setFill(doc, rating.color)
    doc.roundedRect(barX, barY, barW * (p.score / 100), barH, 0.5, 0.5, 'F')

    rowY += rowH
  })

  return sectionY + sectionH + 6
}

function drawNextTerm(doc, card, y) {
  const H = 12, by = y

  setFill(doc, C.accentBg)
  doc.roundedRect(10, by, 190, H, 1.5, 1.5, 'F')
  setDraw(doc, C.accent); doc.setLineWidth(0.2)
  doc.roundedRect(10, by, 190, H, 1.5, 1.5, 'S')

  setFill(doc, C.accent)
  doc.roundedRect(10, by, 3, H, 1.5, 1.5, 'F')
  doc.rect(11, by, 2, H, 'F')

  font(doc, 'bold', 6); setTxt(doc, C.accent)
  doc.text('NEXT TERM BEGINS', 17, by + 5)

  font(doc, 'bold', 8); setTxt(doc, C.ink)
  doc.text(card.next_term_begins || 'To Be Communicated', 17, by + 10)

  font(doc, 'italic', 6); setTxt(doc, C.slate)
  doc.text('Please report with all requirements on time.', 196, by + 7.5, { align: 'right' })

  return by + H + 4
}

function drawComments(doc, card, y) {
  font(doc, 'bold', 7); setTxt(doc, C.muted)
  doc.text('OFFICIAL REMARKS', 10, y + 4)
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.line(10, y + 6, 200, y + 6)

  const panH = 24, py = y + 8

  // ── CLASS TEACHER ─────────────────────────────────────
  setFill(doc, C.surface)
  doc.roundedRect(10, py, 90, panH, 1.5, 1.5, 'F')
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.roundedRect(10, py, 90, panH, 1.5, 1.5, 'S')

  setFill(doc, C.accent)
  doc.roundedRect(10, py, 90, 6, 1.5, 1.5, 'F')
  doc.rect(10, py + 4, 90, 2, 'F')

  font(doc, 'bold', 7); setTxt(doc, C.white)
  doc.text('CLASS TEACHER', 14, py + 4.5)

  font(doc, 'normal', 8); setTxt(doc, C.inkSoft)
  const ctLines = doc.splitTextToSize(card.class_teacher_comment || 'No comment provided.', 80)
  doc.text(ctLines.slice(0, 2), 14, py + 12)

  setDraw(doc, C.rule); doc.setLineWidth(0.2)
  doc.line(14, py + panH - 3, 72, py + panH - 3)
  font(doc, 'normal', 6); setTxt(doc, C.muted)
  doc.text('Signature', 14, py + panH - 0.5)

  // ── HEAD TEACHER ──────────────────────────────────────
  setFill(doc, C.surface)
  doc.roundedRect(108, py, 90, panH, 1.5, 1.5, 'F')
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.roundedRect(108, py, 90, panH, 1.5, 1.5, 'S')

  setFill(doc, C.ink)
  doc.roundedRect(108, py, 90, 6, 1.5, 1.5, 'F')
  doc.rect(108, py + 4, 90, 2, 'F')

  font(doc, 'bold', 7); setTxt(doc, C.white)
  doc.text('HEAD TEACHER', 112, py + 4.5)

  font(doc, 'normal', 8); setTxt(doc, C.inkSoft)
  const htLines = doc.splitTextToSize(card.head_teacher_comment || 'No comment provided.', 80)
  doc.text(htLines.slice(0, 2), 112, py + 12)

  setDraw(doc, C.rule); doc.setLineWidth(0.2)
  doc.line(112, py + panH - 3, 170, py + panH - 3)
  font(doc, 'normal', 6); setTxt(doc, C.muted)
  doc.text('Signature', 112, py + panH - 0.5)

  return py + panH + 4
}

function drawGradingSummary(doc, y, bands) {
  const PAD = 10

  font(doc, 'bold', 7); setTxt(doc, C.muted)
  doc.text('GRADING SYSTEM', PAD, y + 4)
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.line(PAD, y + 6, 200, y + 6)

  const sectionY = y + 9
  const sectionH = 24

  // ── LEFT ──────────────────────────────────────────────
  setFill(doc, C.surface)
  doc.roundedRect(PAD, sectionY, 118, sectionH, 1.5, 1.5, 'F')
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.roundedRect(PAD, sectionY, 118, sectionH, 1.5, 1.5, 'S')

  if (!bands?.length) {
    font(doc, 'normal', 7); setTxt(doc, C.muted)
    doc.text('No grading scale defined.', PAD + 3, sectionY + 10)
  } else {
    font(doc, 'bold', 6); setTxt(doc, C.muted)
    doc.text('GRADES', PAD + 3, sectionY + 7)
    let gx = PAD + 22
    bands.forEach(b => {
      font(doc, 'bold', 7); setTxt(doc, b.color_hex || C.accent)
      doc.text(b.grade, gx, sectionY + 7)
      font(doc, 'normal', 5.5); setTxt(doc, C.muted)
      doc.text(`${b.min_mark}–${b.max_mark}`, gx, sectionY + 12)
      gx += 13
    })

    setDraw(doc, C.rule); doc.setLineWidth(0.1)
    doc.line(PAD + 2, sectionY + 14, PAD + 116, sectionY + 14)

    const DIVS = [
      { label: 'DIV I',   range: '4–12',  color: C.div1 },
      { label: 'DIV II',  range: '13–23', color: C.div2 },
      { label: 'DIV III', range: '24–29', color: C.div3 },
      { label: 'DIV IV',  range: '30–34', color: C.div4 },
      { label: 'U',       range: '35+',   color: C.divU },
    ]
    font(doc, 'bold', 6); setTxt(doc, C.muted)
    doc.text('DIVS', PAD + 3, sectionY + 19)
    let dx = PAD + 22
    DIVS.forEach(d => {
      font(doc, 'bold', 6.5); setTxt(doc, d.color)
      doc.text(d.label, dx, sectionY + 19)
      font(doc, 'normal', 5.5); setTxt(doc, C.muted)
      doc.text(d.range, dx, sectionY + 23)
      dx += 22
    })
  }

  // ── RIGHT: Stamp & Signature ──────────────────────────
  const rightX = PAD + 122, rightW = 68

  setFill(doc, C.surface)
  doc.roundedRect(rightX, sectionY, rightW, sectionH, 1.5, 1.5, 'F')
  setDraw(doc, C.rule); doc.setLineWidth(0.1)
  doc.roundedRect(rightX, sectionY, rightW, sectionH, 1.5, 1.5, 'S')

  const stampCX = rightX + 17, stampCY = sectionY + sectionH / 2
  setDraw(doc, C.rule); doc.setLineWidth(0.5)
  doc.circle(stampCX, stampCY, 9, 'S')
  setDraw(doc, C.rule); doc.setLineWidth(0.2)
  doc.circle(stampCX, stampCY, 7.5, 'S')
  font(doc, 'normal', 5); setTxt(doc, C.muted)
  doc.text('OFFICIAL', stampCX, stampCY - 1.5, { align: 'center' })
  doc.text('STAMP', stampCX, stampCY + 3, { align: 'center' })

  const sigX = rightX + 36, sigEndX = rightX + rightW - 4, sigLineY = sectionY + sectionH - 7
  setDraw(doc, C.muted); doc.setLineWidth(0.3)
  doc.line(sigX, sigLineY, sigEndX, sigLineY)
  font(doc, 'normal', 5.5); setTxt(doc, C.muted)
  doc.text('Head Teacher Signature', sigX + (sigEndX - sigX) / 2, sigLineY + 4, { align: 'center' })

  return sectionY + sectionH + 5
}
// ── Footer ────────────────────────────────────────────────────────────────────
function addFooter(doc, schoolName) {
  const n  = doc.internal.getNumberOfPages()
  const ts = new Date().toLocaleDateString('en-UG', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)

    // Accent bottom bar
    setFill(doc, C.accent)
    doc.rect(0, 292, 210, 5, 'F')

    // Left — school name
    font(doc, 'bold', 4.5); setTxt(doc, C.white)
    doc.text(schoolName || 'School', 13, 295.5)

    // Center — generated date
    font(doc, 'normal', 4.5); setTxt(doc, C.white)
    doc.text(`EXEDUEX SCHOOL MANAGEMENT SYSTEM           ~    Generated: ${ts}`, 105, 295.5, { align: 'center' })

   
  }
}

function ensureSpace(doc, y, needed) {
  if (y + needed > 275) { doc.addPage(); drawPageBg(doc); return 18 }
  return y
}

// ── Core renderer ─────────────────────────────────────────────────────────────
async function renderCard(doc, card, schoolName, attendanceData, gradeBands, newPage) {
  if (newPage) doc.addPage()
  drawPageBg(doc)

  doc.__schoolName = schoolName
  doc.__examLabel  = card.exam_name || 'Report Card'

  let y = drawHeader(doc, schoolName, card.exam_name || 'Report Card')
  y = drawStudentPanel(doc, card, y)
  y = drawResultSummary(doc, card, gradeBands, y)
  y = drawMarksTable(doc, card.marks || [], y, gradeBands)

  y = ensureSpace(doc, y, 10)
  y = drawGradingSummary(doc, y, gradeBands)

  if (attendanceData) {
    y = ensureSpace(doc, y, 8)
    y = drawAttendanceSummary(doc, attendanceData, y, card)
  }


  y = ensureSpace(doc, y, 9)
  drawComments(doc, card, y)
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════

export async function printReportCard(card, schoolName, logoUrl, gradeBands, attendanceData = null) {
  gradeBands = Array.isArray(gradeBands) ? gradeBands : []
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  await renderCard(doc, card, schoolName, attendanceData, gradeBands, false)
  addFooter(doc, schoolName)
  doc.save(`report-card-${card.student_number || card.student_id}.pdf`)
}

export async function printClassReportCards(cards, examName, className, schoolName, logoUrl, gradeBands, attendanceMap = {}) {
  if (!cards?.length) return
  gradeBands = Array.isArray(gradeBands) ? gradeBands : []

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  for (let i = 0; i < cards.length; i++) {
    await renderCard(
      doc,
      { ...cards[i], exam_name: examName },
      schoolName,
      attendanceMap[cards[i].student_id] || null,
      gradeBands,
      i > 0,
    )
  }
  addFooter(doc, schoolName)
  doc.save(`report-cards-${className.replace(/\s/g, '-')}.pdf`)
}

export async function printClassMarksheet(cards, examName, className, schoolName, subjects = [], gradeBands = []) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  setFill(doc, C.ink); doc.rect(0, 0, 297, 20, 'F')
  setFill(doc, C.accent); doc.rect(0, 20, 297, 2, 'F')

  font(doc, 'bold', 12); setTxt(doc, C.white)
  doc.text(schoolName || 'School', 12, 10)
  font(doc, 'normal', 7); setTxt(doc, '#9CA3AF')
  doc.text(`Assessment Marksheet  ·  ${className}  ·  ${examName}`, 12, 17)
  font(doc, 'bold', 7); setTxt(doc, '#6B7280')
  doc.text(`${cards.length} Entries`, 285, 12, { align: 'right' })

  const head = ['#', 'Student Name', 'Adm. No.']
  subjects.forEach(s => head.push(s.subject_name || s.name || ''))
  head.push('Agg.', 'Div.', 'Pos.')

  const body = cards.map((c, i) => {
    const row = [i + 1, `${c.first_name} ${c.last_name}`, c.student_number || '—']
    subjects.forEach(s => {
      const m = (c.marks || []).find(mk =>
        mk.subject_id === s.subject_id || mk.subject_name === (s.subject_name || s.name))
      row.push(m ? (m.grade || (m.marks_obtained ?? '—')) : '—')
    })
    row.push(c.aggregate ?? '—', c.division || 'U', c.position_in_class ?? '—')
    return row
  })

  const subW = subjects.length ? Math.max(10, Math.floor(170 / subjects.length)) : 0

  autoTable(doc, {
    startY: 25,
    head: [head],
    body,
    headStyles: {
      fillColor: rgb(C.ink), textColor: [255,255,255], fontStyle: 'bold', fontSize: 7,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 8, textColor: rgb(C.inkSoft),
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', textColor: rgb(C.muted) },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      ...Object.fromEntries(subjects.map((_, i) => [i+3, { cellWidth: subW, halign: 'center' }])),
      [head.length-3]: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      [head.length-2]: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      [head.length-1]: { cellWidth: 14, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body') {
        const raw = data.cell.raw
        const gc  = gradeColor(raw, gradeBands)
        if (gc && gc !== C.NG) data.cell.styles.textColor = rgb(gc)
        if (data.column.index === head.length - 3 && !isNaN(raw)) {
          data.cell.styles.textColor = rgb(aggToDivision(parseInt(raw)).color)
        }
        if (data.column.index === head.length - 2) {
          const dc  = { '1': C.div1, '2': C.div2, '3': C.div3, '4': C.div4, 'U': C.divU }
          data.cell.styles.textColor = rgb(dc[raw] || C.muted)
        }
      }
    },
    alternateRowStyles: { fillColor: rgb(C.surface) },
    styles: { lineColor: rgb(C.rule), lineWidth: 0.12 },
    margin: { left: 10, right: 10 },
  })

  const n  = doc.internal.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    setDraw(doc, C.rule); doc.setLineWidth(0.15); doc.line(10, 198, 287, 198)
    font(doc, 'normal', 5.5); setTxt(doc, C.muted)
    doc.text(`${schoolName} · ${examName} · ${className}`, 12, 203)
    doc.text(`Page ${i} of ${n}`, 287, 203, { align: 'right' })
  }

  doc.save(`marksheet-${className.replace(/\s/g, '-')}.pdf`)
}

export function printAttendanceReport(data, title, schoolName) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  drawPageBg(doc)

  setFill(doc, C.ink); doc.rect(0, 0, 210, 20, 'F')
  setFill(doc, C.accent); doc.rect(0, 20, 210, 2, 'F')
  font(doc, 'bold', 11); setTxt(doc, C.white)
  doc.text(schoolName || 'School', 12, 10)
  font(doc, 'normal', 7); setTxt(doc, '#9CA3AF')
  doc.text(title || 'Attendance Report', 12, 17)

  let startY = 26

  if (data.summary) {
    const s = data.summary
    const rate = s.attendance_percent ?? 0
    const rateColor = rate >= 90 ? C.div1 : rate >= 75 ? C.div2 : rate >= 60 ? C.div4 : C.divU
    const stats = [
      { l: 'Total', v: s.total_days ?? '—' },
      { l: 'Present', v: s.present_days ?? '—', c: C.div1 },
      { l: 'Absent', v: s.absent_days ?? '—', c: C.divU },
      { l: 'Late', v: s.late_days ?? '—', c: C.div4 },
      { l: 'Rate', v: `${rate}%`, c: rateColor },
    ]
    setFill(doc, C.surface); doc.roundedRect(10, startY, 190, 18, 2, 2, 'F')
    setDraw(doc, C.rule); doc.setLineWidth(0.15); doc.roundedRect(10, startY, 190, 18, 2, 2, 'S')
    let sx = 20
    stats.forEach(st => {
      font(doc, 'bold', 14); setTxt(doc, st.c || C.ink)
      doc.text(String(st.v), sx + 12, startY + 11, { align: 'center' })
      font(doc, 'normal', 5); setTxt(doc, C.muted)
      doc.text(st.l, sx + 12, startY + 16, { align: 'center' })
      sx += 38
    })
    startY += 24
  }

  if (data.daily?.length) {
    autoTable(doc, {
      startY,
      head: [['Date', 'Day', 'Status', 'Check-In', 'Check-Out', 'Remarks']],
      body: data.daily.map(d => [
        d.attendance_date || '—',
        d.attendance_date ? new Date(d.attendance_date).toLocaleDateString('en-UG', { weekday: 'short' }) : '',
        (d.status || '').toUpperCase().replace(/_/g, ' '),
        d.check_in_time  || '—',
        d.check_out_time || '—',
        d.remarks || '',
      ]),
      headStyles: { fillColor: rgb(C.ink), textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 8.5, textColor: rgb(C.inkSoft) },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 2) {
          const m = { PRESENT: C.div1, ABSENT: C.divU, LATE: C.div4, 'HALF DAY': '#7C3AED', EXCUSED: '#0891B2' }
          const c = m[data.cell.raw?.toUpperCase()]
          if (c) data.cell.styles.textColor = rgb(c)
        }
      },
      alternateRowStyles: { fillColor: rgb(C.surface) },
      styles: { lineColor: rgb(C.rule), lineWidth: 0.12 },
      margin: { left: 10, right: 10 },
    })
  }

  addFooter(doc, schoolName)
  doc.save('attendance-report.pdf')
}
