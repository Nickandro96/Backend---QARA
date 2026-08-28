declare namespace PDFKit {
  type PDFDocument = any;
}

declare module "pdfkit" {
  const PDFDocument: any;
  export default PDFDocument;
}
