/**
 * examPdf.js — Professional Academic PDF Generator
 * Features: school logo, student photo slot, barcode, attendance, Uganda PLE grades
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import JsBarcode from 'jsbarcode'

// ── Design tokens ────────────────────────────────────────
const C = {
  navy:'#0F172A', blue:'#1D4ED8', blueL:'#DBEAFE',
  slate:'#64748B', slateL:'#F1F5F9', white:'#FFFFFF', border:'#E2E8F0',
}
const GRADE_CLR = {
  D1:'#059669',D2:'#10B981',C3:'#1D4ED8',C4:'#3B82F6',
  C5:'#60A5FA',C6:'#93C5FD',P7:'#D97706',P8:'#F59E0B',F9:'#DC2626',NG:'#94A3B8',
}
const AGG_CLR = (a) => {
  if (a==null) return C.slate
  if (a<=8)  return '#059669'
  if (a<=14) return '#1D4ED8'
  if (a<=20) return '#7C3AED'
  if (a<=28) return '#D97706'
  return '#DC2626'
}
function h2r(hex) {
  const h=hex.replace('#','')
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]
}

// ── Barcode ────────────────────────────────────────────────
function barcodeImg(text) {
  try {
    const c=document.createElement('canvas')
    JsBarcode(c,String(text||'0'),{format:'CODE128',width:1.4,height:26,displayValue:false,margin:2,background:'#fff',lineColor:'#0F172A'})
    return c.toDataURL('image/png')
  } catch { return null }
}

// ── Image loader ───────────────────────────────────────────
async function loadImg(src) {
  if (!src) return null
  return new Promise(res=>{
    const img=new Image(); img.crossOrigin='anonymous'
    img.onload=()=>{ const c=document.createElement('canvas'); c.width=img.naturalWidth||100; c.height=img.naturalHeight||100; c.getContext('2d').drawImage(img,0,0); res(c.toDataURL('image/png')) }
    img.onerror=()=>res(null); img.src=src
  })
}

// ── Footer ─────────────────────────────────────────────────
function addFooter(doc, schoolName) {
  const n=doc.internal.getNumberOfPages()
  const ts=new Date().toLocaleString('en-UG',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})
  for(let i=1;i<=n;i++){
    doc.setPage(i)
    doc.setDrawColor(...h2r(C.border)); doc.setLineWidth(0.25); doc.line(14,284,196,284)
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...h2r(C.slate))
    doc.text(`${schoolName||'School'} — Confidential Academic Record`,14,289)
    doc.text(`Printed: ${ts}  |  Page ${i} of ${n}`,196,289,{align:'right'})
  }
}

// ── Letterhead ─────────────────────────────────────────────
async function drawLetterhead(doc, schoolName, logoUrl, subtitle) {
  const logo=await loadImg(logoUrl)
  doc.setFillColor(...h2r(C.navy)); doc.rect(0,0,210,30,'F')
  doc.setFillColor(...h2r(C.blue)); doc.rect(0,30,210,3,'F')
  if(logo){
    doc.addImage(logo,'PNG',13,4,22,22)
  } else {
    doc.setFillColor(...h2r(C.blue)); doc.circle(24,15,9,'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...h2r(C.white))
    doc.text((schoolName||'S')[0].toUpperCase(),24,18.5,{align:'center'})
  }
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...h2r(C.white))
  doc.text(schoolName||'School',41,13)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...h2r(C.blueL))
  doc.text(subtitle||'Academic Report',41,20)
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(180,200,255)
  doc.text('OFFICIAL ACADEMIC DOCUMENT',196,26,{align:'right'})
  return 37
}

// ── Student info panel ─────────────────────────────────────
async function drawStudentPanel(doc, card, y) {
  const H=38
  doc.setFillColor(...h2r(C.slateL)); doc.roundedRect(14,y,182,H,2,2,'F')
  doc.setDrawColor(...h2r(C.border)); doc.setLineWidth(0.3); doc.roundedRect(14,y,182,H,2,2,'S')

  // Photo box
  const PX=167,PY=y+3,PW=25,PH=32
  doc.setFillColor(210,222,240); doc.roundedRect(PX,PY,PW,PH,1.5,1.5,'F')
  doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(...h2r(C.slate))
  doc.text('PASSPORT',PX+PW/2,PY+PH/2+1,{align:'center'})
  doc.text('PHOTO',PX+PW/2,PY+PH/2+5,{align:'center'})

  // Details grid
  const fields=[
    ['Full Name',     `${card.first_name||''} ${card.last_name||''}`.trim()||'—'],
    ['Adm. Number',   card.student_number||'—'],
    ['Class / Stream',`${card.class_name||'—'}${card.stream_name?' / '+card.stream_name:''}`],
    ['Academic Year', card.academic_year_name||'—'],
    ['Term',          card.term_name||'—'],
    ['Exam',          card.exam_name||'—'],
  ]
  fields.forEach(([lbl,val],i)=>{
    const col=i%2, row=Math.floor(i/2)
    const fx=20+col*76, fy=y+8+row*11
    doc.setFont('helvetica','bold'); doc.setFontSize(5.5); doc.setTextColor(...h2r(C.slate))
    doc.text(lbl.toUpperCase(),fx,fy)
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...h2r(C.navy))
    doc.text(String(val).substring(0,32),fx,fy+4.5)
  })

  // Barcode
  const bc=barcodeImg(card.student_number||card.student_id)
  if(bc){ doc.addImage(bc,'PNG',PX-40,y+H-14,38,11); doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(...h2r(C.slate)); doc.text(String(card.student_number||''),PX-21,y+H-2,{align:'center'}) }

  return y+H+4
}

// ── Aggregate bar ──────────────────────────────────────────
const DIV_COLORS = { '1':'#059669','2':'#1D4ED8','3':'#7C3AED','4':'#D97706','U':'#DC2626' }

function drawAggBar(doc, card, y) {
  const agg=card.aggregate, ac=AGG_CLR(agg)
  const div=card.division||'U'
  const divColor=DIV_COLORS[div]||'#DC2626'
  doc.setFillColor(...h2r(C.navy)); doc.roundedRect(14,y,182,20,2,2,'F')

  // Aggregate number
  doc.setFont('helvetica','bold'); doc.setFontSize(24); doc.setTextColor(...h2r(ac))
  doc.text(agg!=null?String(agg):'—',30,y+13)
  doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(...h2r(C.blueL))
  doc.text('AGGREGATE',30,y+18)

  // Divider
  doc.setDrawColor(255,255,255); doc.setLineWidth(0.2); doc.line(56,y+4,56,y+16)

  // DIVISION — the key result prominently displayed
  const divLabel = div==='U' ? 'UNGRADED' : `DIVISION ${div}`
  doc.setFillColor(...h2r(divColor)); doc.roundedRect(60,y+3,32,14,2,2,'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(div==='U'?7:9); doc.setTextColor(255,255,255)
  doc.text(divLabel,76,y+12,{align:'center'})

  // Divider 2
  doc.setDrawColor(255,255,255); doc.setLineWidth(0.2); doc.line(96,y+4,96,y+16)

  // Position
  const pos=card.position_in_class, tot=card.total_students_in_class
  doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...h2r(C.white))
  doc.text(pos?`${pos}${pos===1?'st':pos===2?'nd':pos===3?'rd':'th'}`:'—',108,y+13)
  doc.setFont('helvetica','normal'); doc.setFontSize(6); doc.setTextColor(...h2r(C.blueL))
  doc.text(`OF ${tot||'—'}`,108,y+18)

  // Grade pills (right side)
  const gs=typeof card.grade_summary==='string'?JSON.parse(card.grade_summary||'{}'):(card.grade_summary||{})
  let gx=124
  ;['D1','D2','C3','C4','C5','C6','P7','P8','F9'].forEach(g=>{
    if(gs[g]&&gx<190){
      const [r,gb,b]=h2r(GRADE_CLR[g]||C.slate)
      doc.setFillColor(r,gb,b); doc.roundedRect(gx,y+5,15,10,1.5,1.5,'F')
      doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(255,255,255)
      doc.text(`${g}×${gs[g]}`,gx+7.5,y+12,{align:'center'})
      gx+=17
    }
  })
  return y+24
}

// ── Marks table ────────────────────────────────────────────
function drawMarksTable(doc, marks, y) {
  autoTable(doc,{
    startY:y,
    head:[['#','Subject','Max','Score','%','Grade','Pts','Remarks']],
    body:marks.map((m,i)=>[
      i+1, m.subject_name||'—', m.exam_max_mark||m.max_mark||100,
      m.is_absent?'ABS':m.is_exempt?'EXM':(m.marks_obtained??'—'),
      m.percentage!=null?`${m.percentage}%`:'—',
      m.grade||(m.is_gradable?'—':'NG'),
      m.is_gradable&&m.grade_points!=null?m.grade_points:'—',
      m.remarks||'',
    ]),
    headStyles:{fillColor:h2r(C.navy),textColor:[255,255,255],fontStyle:'bold',fontSize:7.5,cellPadding:2.5},
    bodyStyles:{fontSize:8,cellPadding:2.2},
    columnStyles:{
      0:{cellWidth:7,halign:'center'},1:{cellWidth:50},2:{cellWidth:12,halign:'center'},
      3:{cellWidth:14,halign:'center',fontStyle:'bold'},4:{cellWidth:14,halign:'center'},
      5:{cellWidth:14,halign:'center',fontStyle:'bold'},6:{cellWidth:10,halign:'center'},7:{},
    },
    didParseCell(data){
      if(data.section==='body'){
        if(data.column.index===5&&GRADE_CLR[data.cell.raw]) data.cell.styles.textColor=h2r(GRADE_CLR[data.cell.raw])
        if(data.column.index===3&&(data.cell.raw==='ABS'||data.cell.raw==='EXM')) data.cell.styles.textColor=h2r('#DC2626')
      }
    },
    alternateRowStyles:{fillColor:h2r(C.slateL)},
    styles:{lineColor:h2r(C.border),lineWidth:0.2},
    margin:{left:14,right:14},
  })
  return doc.lastAutoTable.finalY+4
}

// ── Attendance row ─────────────────────────────────────────
function drawAttRow(doc, att, y) {
  if(!att) return y
  const items=[
    {l:'School Days',v:att.total_days??'—',c:C.navy},
    {l:'Present',v:att.present_days??'—',c:'#059669'},
    {l:'Absent',v:att.absent_days??'—',c:'#DC2626'},
    {l:'Late',v:att.late_days??'—',c:'#D97706'},
    {l:'Excused',v:att.excused_days??'—',c:'#7C3AED'},
    {l:'Rate',v:att.attendance_percent!=null?`${att.attendance_percent}%`:'—',c:'#1D4ED8'},
  ]
  const bw=29,bh=14,gap=3.5
  const tw=items.length*(bw+gap)-gap, sx=(210-tw)/2
  doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...h2r(C.slate))
  doc.text('ATTENDANCE SUMMARY',14,y+4)
  items.forEach((it,i)=>{
    const x=sx+i*(bw+gap)
    doc.setFillColor(...h2r(C.slateL)); doc.roundedRect(x,y,bw,bh,1.5,1.5,'F')
    doc.setDrawColor(...h2r(C.border)); doc.setLineWidth(0.2); doc.roundedRect(x,y,bw,bh,1.5,1.5,'S')
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...h2r(it.c))
    doc.text(String(it.v),x+bw/2,y+8.5,{align:'center'})
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(...h2r(C.slate))
    doc.text(it.l,x+bw/2,y+12.5,{align:'center'})
  })
  return y+bh+5
}

// ── Comments panel ─────────────────────────────────────────
function drawComments(doc, card, y) {
  const H=30
  // CT
  doc.setFillColor(...h2r(C.slateL)); doc.roundedRect(14,y,88,H,2,2,'F')
  doc.setDrawColor(...h2r(C.border)); doc.setLineWidth(0.2); doc.roundedRect(14,y,88,H,2,2,'S')
  doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...h2r(C.blue))
  doc.text("CLASS TEACHER'S COMMENT",19,y+6)
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...h2r(C.navy))
  doc.text(doc.splitTextToSize(card.class_teacher_comment||'No comment.',78),19,y+11)
  doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...h2r(C.slate))
  doc.text('Signature: ____________________',19,y+27)
  // HM
  doc.setFillColor(...h2r(C.slateL)); doc.roundedRect(108,y,88,H,2,2,'F')
  doc.roundedRect(108,y,88,H,2,2,'S')
  doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...h2r(C.blue))
  doc.text("HEAD TEACHER'S COMMENT",113,y+6)
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...h2r(C.navy))
  doc.text(doc.splitTextToSize(card.head_teacher_comment||'No comment.',78),113,y+11)
  doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...h2r(C.slate))
  doc.text('Signature: ____________________',113,y+27)
  // Stamp
  doc.setLineDash([1.5,1.5])
  doc.roundedRect(58,y+18,40,12,1.5,1.5,'S')
  doc.setLineDash([])
  doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(...h2r(C.slate))
  doc.text('SCHOOL STAMP / SEAL',78,y+25,{align:'center'})
  return y+H+4
}

// ── Curriculum summary (if available) ─────────────────────
function drawCurriculumSummary(doc, curriculum, y) {
  if (!curriculum || !curriculum.subjects?.length) return y

  // Section label
  doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...h2r(C.slate))
  doc.text('CURRICULUM PERFORMANCE THIS TERM', 14, y+4)

  // Summary stats row
  const stats = [
    { l:'Lessons', v: String(curriculum.lessons_attended||curriculum.total_lessons||0), c:C.navy },
    { l:'Avg Mark', v: curriculum.avg_mark!=null?`${Number(curriculum.avg_mark).toFixed(1)}%`:'—', c:'#059669' },
    { l:'Subjects', v: String(curriculum.subjects?.length||0), c:'#7C3AED' },
  ]
  const bw=35, bh=12, gap=4, sx=14
  stats.forEach((st,i)=>{
    const x=sx+i*(bw+gap)
    doc.setFillColor(...h2r(C.slateL)); doc.roundedRect(x,y+6,bw,bh,1.5,1.5,'F')
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...h2r(st.c))
    doc.text(String(st.v),x+bw/2,y+13,{align:'center'})
    doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(...h2r(C.slate))
    doc.text(st.l,x+bw/2,y+17,{align:'center'})
  })

  // Subject table
  autoTable(doc, {
    startY: y+22,
    head:[['Subject','Lessons','Avg Mark','Topics Covered']],
    body: curriculum.subjects.map(s=>[
      s.subject_name||'—',
      s.lessons_count||'—',
      s.avg_mark!=null?`${Number(s.avg_mark).toFixed(1)}%`:'—',
      s.topics_covered!=null?String(s.topics_covered):'—',
    ]),
    headStyles:{fillColor:h2r(C.navy),textColor:[255,255,255],fontStyle:'bold',fontSize:7,cellPadding:2},
    bodyStyles:{fontSize:7.5,cellPadding:2},
    columnStyles:{
      0:{cellWidth:60},
      1:{halign:'center',cellWidth:20},
      2:{halign:'center',cellWidth:22,fontStyle:'bold'},
      3:{halign:'center'},
    },
    alternateRowStyles:{fillColor:h2r(C.slateL)},
    styles:{lineColor:h2r(C.border),lineWidth:0.2},
    margin:{left:14,right:14},
  })
  return doc.lastAutoTable.finalY+4
}

// ── One card renderer ──────────────────────────────────────
async function renderCard(doc, card, schoolName, logoUrl, attendance, newPage) {
  if(newPage) doc.addPage()
  let y=await drawLetterhead(doc,schoolName,logoUrl,card.exam_name||'Report Card')
  y=await drawStudentPanel(doc,card,y)
  y=drawAggBar(doc,card,y)
  y=drawMarksTable(doc,card.marks||[],y)
  y=drawAttRow(doc,attendance||null,y)
  // Curriculum performance summary (if loaded with the card)
  if(card._curriculum) y=drawCurriculumSummary(doc,card._curriculum,y)
  drawComments(doc,card,y)
}

// ═══════════════════════════════════════════════════════════
// PUBLIC EXPORTS
// ═══════════════════════════════════════════════════════════

/** Single student report card */
export async function printReportCard(card, schoolName, logoUrl, attendance) {
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  await renderCard(doc,card,schoolName,logoUrl,attendance,false)
  addFooter(doc,schoolName)
  doc.save(`report-card-${card.student_number||card.student_id}.pdf`)
}

/** All cards for one class → single PDF */
export async function printClassReportCards(cards, examName, className, schoolName, logoUrl, attMap={}) {
  if(!cards.length) return
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  for(let i=0;i<cards.length;i++){
    await renderCard(doc,{...cards[i],exam_name:examName},schoolName,logoUrl,attMap[cards[i].student_id],i>0)
  }
  addFooter(doc,schoolName)
  doc.save(`report-cards-${className.replace(/\s/g,'-')}.pdf`)
}

/** Assessment marksheet — landscape */
export function printClassMarksheet(cards, examName, className, schoolName, subjects=[]) {
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  // Header
  doc.setFillColor(...h2r(C.navy)); doc.rect(0,0,297,22,'F')
  doc.setFillColor(...h2r(C.blue)); doc.rect(0,22,297,2.5,'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...h2r(C.white))
  doc.text(schoolName||'School',14,11)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...h2r(C.blueL))
  doc.text(`Assessment Marksheet  |  ${className}  |  ${examName}`,14,18)
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...h2r(C.white))
  doc.text(`${cards.length} Students`,283,13,{align:'right'})

  const head=['#','Student Name','Adm. No.']
  subjects.forEach(s=>head.push(s.subject_name||s.name||''))
  head.push('Aggregate','Division','Position')

  const body=cards.map((c,i)=>{
    const row=[i+1,`${c.first_name} ${c.last_name}`,c.student_number||'—']
    subjects.forEach(s=>{
      const m=(c.marks||[]).find(mk=>mk.subject_id===s.subject_id||mk.subject_name===(s.subject_name||s.name))
      row.push(m?(m.grade||(m.marks_obtained??'—')):'—')
    })
    row.push(c.aggregate??'—', c.division||'U', c.position_in_class??'—')
    return row
  })

  const subW=subjects.length?Math.max(10,Math.floor(180/subjects.length)):0
  autoTable(doc,{
    startY:28,head:[head],body,
    headStyles:{fillColor:h2r(C.navy),textColor:[255,255,255],fontStyle:'bold',fontSize:7,cellPadding:2},
    bodyStyles:{fontSize:7.5,cellPadding:2},
    columnStyles:{
      0:{cellWidth:8,halign:'center'},1:{cellWidth:52},2:{cellWidth:24},
      ...Object.fromEntries(subjects.map((_,i)=>[i+3,{cellWidth:subW,halign:'center'}])),
      [head.length-3]:{cellWidth:16,halign:'center',fontStyle:'bold'},  // Aggregate
      [head.length-2]:{cellWidth:18,halign:'center',fontStyle:'bold'},  // Division
      [head.length-1]:{cellWidth:14,halign:'center'},                   // Position
    },
    didParseCell(data){
      if(data.section==='body'){
        if(GRADE_CLR[data.cell.raw]) data.cell.styles.textColor=h2r(GRADE_CLR[data.cell.raw])
        // Aggregate column
        if(data.column.index===head.length-3&&!isNaN(data.cell.raw)){
          data.cell.styles.textColor=h2r(AGG_CLR(parseInt(data.cell.raw)))
          data.cell.styles.fontStyle='bold'
        }
        // Division column — colour by division
        if(data.column.index===head.length-2){
          const DC={'1':'#059669','2':'#1D4ED8','3':'#7C3AED','4':'#D97706','U':'#DC2626'}
          const c=DC[data.cell.raw]||'#94A3B8'
          data.cell.styles.textColor=h2r(c)
          data.cell.styles.fontStyle='bold'
        }
      }
    },
    alternateRowStyles:{fillColor:[248,250,252]},
    styles:{lineColor:h2r(C.border),lineWidth:0.2},
    margin:{left:14,right:14},
  })

  // Footer
  const n=doc.internal.getNumberOfPages()
  for(let i=1;i<=n;i++){
    doc.setPage(i)
    doc.setDrawColor(...h2r(C.border)); doc.setLineWidth(0.25); doc.line(14,199,283,199)
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(...h2r(C.slate))
    doc.text(`${schoolName} — ${examName} — ${className} Assessment Sheet`,14,204)
    doc.text(`${i}/${n}`,283,204,{align:'right'})
    doc.text(`Printed: ${new Date().toLocaleString('en-UG')}`,148,204,{align:'center'})
  }
  doc.save(`marksheet-${className.replace(/\s/g,'-')}.pdf`)
}

/** Attendance report */
export function printAttendanceReport(data, title, schoolName) {
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  doc.setFillColor(...h2r(C.navy)); doc.rect(0,0,210,22,'F')
  doc.setFillColor(...h2r(C.blue)); doc.rect(0,22,210,2.5,'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(...h2r(C.white))
  doc.text(schoolName||'School',14,11)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...h2r(C.blueL))
  doc.text(title||'Attendance Report',14,18)

  let startY=30
  // Summary boxes
  if(data.summary){
    const s=data.summary
    const stats=[
      {l:'Total Days',v:s.total_days??'—',c:C.navy},
      {l:'Present',v:s.present_days??'—',c:'#059669'},
      {l:'Absent',v:s.absent_days??'—',c:'#DC2626'},
      {l:'Late',v:s.late_days??'—',c:'#D97706'},
      {l:'Excused',v:s.excused_days??'—',c:'#7C3AED'},
      {l:'Rate',v:s.attendance_percent!=null?`${s.attendance_percent}%`:'—',c:'#1D4ED8'},
    ]
    let sx=14
    stats.forEach(st=>{
      doc.setFillColor(...h2r(C.slateL)); doc.roundedRect(sx,startY,28,16,1.5,1.5,'F')
      doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...h2r(st.c))
      doc.text(String(st.v),sx+14,startY+9.5,{align:'center'})
      doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(...h2r(C.slate))
      doc.text(st.l,sx+14,startY+14,{align:'center'})
      sx+=30
    })
    startY+=22
  }

  if(data.daily?.length){
    autoTable(doc,{
      startY,head:[['Date','Day','Status','Check-In','Check-Out','Remarks']],
      body:data.daily.map(d=>[
        d.attendance_date||'—',
        d.attendance_date?new Date(d.attendance_date).toLocaleDateString('en-UG',{weekday:'short'}):'',
        (d.status||'').toUpperCase().replace(/_/g,' '),
        d.check_in_time||'—',d.check_out_time||'—',d.remarks||'',
      ]),
      headStyles:{fillColor:h2r(C.navy),textColor:[255,255,255],fontStyle:'bold',fontSize:8},
      bodyStyles:{fontSize:8},
      columnStyles:{
        0:{cellWidth:28,fontStyle:'bold'},1:{cellWidth:12,halign:'center'},
        2:{cellWidth:22,halign:'center',fontStyle:'bold'},
        3:{cellWidth:20,halign:'center'},4:{cellWidth:20,halign:'center'},5:{},
      },
      didParseCell(data){
        if(data.section==='body'&&data.column.index===2){
          const m={PRESENT:'#059669',ABSENT:'#DC2626',LATE:'#D97706','HALF DAY':'#7C3AED',EXCUSED:'#0891B2'}
          const c=m[data.cell.raw?.toUpperCase()]; if(c) data.cell.styles.textColor=h2r(c)
        }
      },
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{lineColor:h2r(C.border),lineWidth:0.2},margin:{left:14,right:14},
    })
  }

  if(data.classes?.length){
    autoTable(doc,{
      startY,head:[['Class','Total','Present','Absent','Late','Half-Day','Excused','Rate']],
      body:data.classes.map(r=>[r.class_name||`Class ${r.class_id}`,r.total,r.present,r.absent,r.late,r.half_day,r.excused,r.attendance_rate!=null?`${r.attendance_rate}%`:'—']),
      headStyles:{fillColor:h2r(C.navy),textColor:[255,255,255],fontStyle:'bold',fontSize:8},
      bodyStyles:{fontSize:8.5},
      columnStyles:{
        2:{textColor:h2r('#059669')},3:{textColor:h2r('#DC2626')},
        4:{textColor:h2r('#D97706')},7:{fontStyle:'bold',halign:'center'},
      },
      alternateRowStyles:{fillColor:[248,250,252]},
      styles:{lineColor:h2r(C.border),lineWidth:0.2},margin:{left:14,right:14},
    })
  }

  addFooter(doc,schoolName)
  doc.save('attendance-report.pdf')
}
