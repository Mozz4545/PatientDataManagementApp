export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function lineBreaks(value: unknown) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

export function printLogoHtml() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `<img class="logo" src="${escapeHtml(`${origin}/radiology_logo_minimal.svg`)}" alt="Radiology logo" />`;
}

export function printDocument(title: string, bodyHtml: string) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(`<!doctype html>
<html lang="lo">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #120d34;
        background: #ffffff;
        font-family: "Noto Sans Lao", "Noto Sans Thai", "Segoe UI", Arial, sans-serif;
        font-size: 14px;
      }
      .document {
        min-height: 100vh;
        padding: 8px;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        border-bottom: 2px solid #123879;
        padding-bottom: 16px;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .logo {
        width: 52px;
        height: 52px;
        object-fit: contain;
      }
      .hospital {
        margin: 0;
        color: #123879;
        font-size: 18px;
        font-weight: 800;
      }
      .muted {
        color: #767285;
        font-size: 12px;
        font-weight: 600;
      }
      .title {
        margin: 24px 0 18px;
        text-align: center;
        color: #123879;
        font-size: 26px;
        font-weight: 800;
      }
      .doc-meta {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin: 14px 0 0;
        color: #767285;
        font-size: 12px;
        font-weight: 700;
      }
      .doc-no {
        display: inline-flex;
        border: 1px solid #123879;
        border-radius: 999px;
        padding: 6px 12px;
        color: #123879;
        font-weight: 900;
      }
      .report-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin: 18px 0 20px;
      }
      .report-card {
        border: 1px solid #d9d9d9;
        border-radius: 10px;
        background: #f8fbff;
        padding: 12px;
      }
      .report-card-label {
        color: #767285;
        font-size: 11px;
        font-weight: 800;
      }
      .report-card-value {
        margin-top: 4px;
        color: #123879;
        font-size: 20px;
        font-weight: 900;
      }
      .report-note {
        margin: 10px 0 0;
        color: #767285;
        font-size: 12px;
        font-weight: 700;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 24px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid #e6e6e6;
        padding: 8px 0;
      }
      .label {
        color: #767285;
        font-weight: 700;
      }
      .value {
        text-align: right;
        font-weight: 800;
      }
      .section {
        margin-top: 22px;
      }
      .section-title {
        margin-bottom: 8px;
        color: #123879;
        font-size: 15px;
        font-weight: 800;
      }
      .box {
        min-height: 120px;
        border: 1px solid #d9d9d9;
        border-radius: 10px;
        padding: 14px;
        line-height: 1.7;
        white-space: normal;
      }
      .result-image {
        display: block;
        max-width: 100%;
        max-height: 520px;
        margin-top: 10px;
        border: 1px solid #d9d9d9;
        border-radius: 10px;
        object-fit: contain;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #d9d9d9;
        padding: 10px;
        text-align: left;
      }
      th {
        background: #f2f6fb;
        color: #123879;
        font-weight: 800;
      }
      tbody tr:nth-child(even) td {
        background: #fbfcff;
      }
      .text-right {
        text-align: right;
      }
      .text-center {
        text-align: center;
      }
      .nowrap {
        white-space: nowrap;
      }
      .amount {
        margin-top: 18px;
        border-radius: 12px;
        background: #f2fde9;
        padding: 18px;
        text-align: right;
        color: #137547;
        font-size: 28px;
        font-weight: 900;
      }
      .notice {
        margin-top: 18px;
        border: 1px solid #f4e3b0;
        border-radius: 10px;
        background: #fff9e8;
        padding: 12px 14px;
        color: #7a5a00;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.6;
      }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 56px;
        margin-top: 64px;
        text-align: center;
      }
      .signature-line {
        border-top: 1px solid #120d34;
        padding-top: 8px;
        font-weight: 700;
      }
      .footer {
        margin-top: 28px;
        border-top: 1px solid #e6e6e6;
        padding-top: 10px;
        color: #767285;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
      }
      @media print {
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    ${bodyHtml}
    <script>
      window.addEventListener("load", () => {
        window.focus();
        window.print();
      });
    </script>
  </body>
</html>`);
  printWindow.document.close();
}
