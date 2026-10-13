import fs from 'fs';

let css = fs.readFileSync('public/styles.css', 'utf8');

const mobileFixes = `

/* =========================================
   Mobile UI Fixes (Max-width 520px)
   ========================================= */
@media (max-width: 520px) {
  /* Fix squished PDV rows */
  .pdv-row {
    grid-template-columns: 1fr auto !important;
    gap: 10px !important;
    align-items: center;
  }
  .pdv-row .num, .pdv-row .qty-control, .pdv-row .actions {
    grid-column: auto;
  }

  /* Make tables readable */
  .tablewrap table {
    font-size: 13px !important;
  }
  .tablewrap th, .tablewrap td {
    padding: 10px 8px !important;
  }

  /* Fix Modal padding on very small screens */
  .store-order-dialog, #modal > .panel {
    padding: 14px !important;
    width: 95vw !important;
    max-width: 100vw !important;
  }

  /* Fix Client meta */
  .client-meta {
    flex-direction: column;
    gap: 6px !important;
  }

  /* Expand action buttons to full width to prevent cut-off text */
  .actions {
    flex-wrap: wrap;
    justify-content: stretch;
  }
  .actions .btn {
    flex: 1;
    min-width: 100%;
    margin-bottom: 4px;
  }

  /* Fix PDV Barcode layout */
  .pdv-barcode-row {
    flex-direction: column !important;
    align-items: stretch !important;
  }
  .pdv-barcode-row .field {
    max-width: 100% !important;
    margin-bottom: 8px;
  }
  
  /* Fix order actions flex */
  .order-actions {
    min-width: 100% !important;
    flex-direction: column;
    align-items: stretch;
  }
  
  .store-header {
    flex-wrap: wrap;
  }
}
`;

if (!css.includes('Mobile UI Fixes (Max-width 520px)')) {
  css += mobileFixes;
  fs.writeFileSync('public/styles.css', css);
  console.log('Mobile fixes appended to styles.css');
} else {
  console.log('Mobile fixes already present.');
}
