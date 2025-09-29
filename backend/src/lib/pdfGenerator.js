const PDFDocument = require('pdfkit');

function generateScaffoldsPDF(project, scaffolds, res) {
  const doc = new PDFDocument({ margin: 50 });

  // Configurar la respuesta para que el navegador descargue el archivo
  const filename = `Reporte-Proyecto-${project.name.replace(/\s/g, '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  doc.pipe(res);

  // Encabezado
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Reporte de Andamios - Alltura', { align: 'center' });
  
  doc.moveDown();

  // Información del Proyecto
  doc.fontSize(16).font('Helvetica-Bold').text('Detalles del Proyecto');
  doc.fontSize(12).font('Helvetica');
  doc.text(`Nombre: ${project.name}`);
  doc.text(`Cliente: ${project.client_name}`);
  doc.text(`Fecha de Generación: ${new Date().toLocaleDateString()}`);

  doc.moveDown(2);

  // Resumen
  const totalCubicMeters = scaffolds.reduce((sum, s) => sum + parseFloat(s.cubic_meters), 0);
  doc.fontSize(16).font('Helvetica-Bold').text('Resumen');
  doc.fontSize(12).font('Helvetica');
  doc.text(`Total de Andamios Reportados: ${scaffolds.length}`);
  doc.text(`Total Metros Cúbicos (m³): ${totalCubicMeters.toFixed(2)}`);

  doc.moveDown(2);

  // Tabla de Andamios
  doc.fontSize(16).font('Helvetica-Bold').text('Listado de Andamios');
  doc.moveDown();

  const tableTop = doc.y;
  const itemX = 50;
  const idX = itemX;
  const dimensionsX = 150;
  const volumeX = 280;
  const userX = 350;
  const dateX = 450;

  // Encabezados de la tabla
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('ID', idX, tableTop);
  doc.text('Dimensiones (A x L x P)', dimensionsX, tableTop);
  doc.text('Volumen (m³)', volumeX, tableTop);
  doc.text('Técnico', userX, tableTop);
  doc.text('Fecha Montaje', dateX, tableTop);
  doc.moveTo(itemX, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  // Filas de la tabla
  doc.fontSize(10).font('Helvetica');
  scaffolds.forEach(scaffold => {
    const y = doc.y;
    doc.text(scaffold.id, idX, y);
    doc.text(`${scaffold.height}x${scaffold.width}x${scaffold.depth}`, dimensionsX, y);
    doc.text(parseFloat(scaffold.cubic_meters).toFixed(2), volumeX, y);
    doc.text(scaffold.user_name, userX, y, { width: 100, ellipsis: true });
    doc.text(new Date(scaffold.assembly_created_at).toLocaleDateString(), dateX, y);
    doc.moveDown(1.5);
  });

  // Pie de página
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).text(`Página ${i + 1} de ${pageCount}`, 50, doc.page.height - 50, {
      align: 'center'
    });
  }

  // Finalizar el PDF
  doc.end();
}

module.exports = { generateScaffoldsPDF };