import React from 'react';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
  notes?: string;
}

export interface ReceiptData {
  hotelName: string;
  hotelAddress?: string;
  hotelPhone?: string;
  currency: string;
  receiptFooter?: string;
  orderNumber: string;
  cashierName: string;
  createdAt: string;
  tableRef?: string;
  roomNumber?: string;
  guestName?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  amountPaid?: number;
  change?: number;
  shiftId?: string;
}

export interface KOTData {
  hotelName: string;
  orderNumber: string;
  tableRef?: string;
  roomNumber?: string;
  cashierName: string;
  createdAt: string;
  items: { name: string; quantity: number; notes?: string }[];
}

// ─── GUEST RECEIPT / FOLIO ────────────────────────────────────────────────────
export const GuestReceiptTemplate: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const lines = '-'.repeat(40);
  const fmt = (n: number) => `${data.currency} ${n.toFixed(2)}`;
  const pad = (left: string, right: string, total = 38) => {
    const spaces = Math.max(1, total - left.length - right.length);
    return left + ' '.repeat(spaces) + right;
  };

  return (
    <div style={{
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '12px',
      width: '302px', // 80mm = 302px at 96dpi
      margin: '0 auto',
      background: 'white',
      color: 'black',
      padding: '8px 12px',
      boxSizing: 'border-box',
      lineHeight: 1.5
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '1px' }}>{data.hotelName}</div>
        {data.hotelAddress && <div>{data.hotelAddress}</div>}
        {data.hotelPhone && <div>Tel: {data.hotelPhone}</div>}
      </div>

      <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '4px' }}>OFFICIAL RECEIPT / TAX INVOICE</div>
      <pre style={{ margin: 0 }}>{lines}</pre>

      {/* Order Info */}
      <pre style={{ margin: 0, fontSize: '11px' }}>
        {pad('Receipt#:', `#${data.orderNumber}`)}
        {'\n'}{pad('Date:', new Date(data.createdAt).toLocaleDateString())}
        {'\n'}{pad('Time:', new Date(data.createdAt).toLocaleTimeString())}
        {'\n'}{pad('Cashier:', data.cashierName)}
        {data.tableRef ? `\n${pad('Table:', data.tableRef)}` : ''}
        {data.roomNumber ? `\n${pad('Room:', data.roomNumber)}` : ''}
        {data.guestName ? `\n${pad('Guest:', data.guestName)}` : ''}
      </pre>

      <pre style={{ margin: '4px 0' }}>{lines}</pre>

      {/* Items */}
      <pre style={{ margin: 0, fontSize: '11px' }}>
        {pad('ITEM', 'TOTAL')}
        {'\n'}{lines}
        {'\n'}
        {data.items.map(item => (
          `  ${item.quantity}x ${item.name}\n${pad('   @' + fmt(item.price) + ' each', fmt(item.subtotal))}${item.notes ? `\n   *** ${item.notes} ***` : ''}\n`
        )).join('')}
      </pre>

      <pre style={{ margin: '4px 0' }}>{lines}</pre>

      {/* Totals */}
      <pre style={{ margin: 0, fontSize: '11px' }}>
        {pad('Subtotal:', fmt(data.subtotal))}
        {'\n'}{pad(`Tax (${data.taxRate}%):`, fmt(data.taxAmount))}
        {data.discount && data.discount > 0 ? `\n${pad('Discount:', '-' + fmt(data.discount))}` : ''}
      </pre>

      <pre style={{ margin: '4px 0' }}>{lines}</pre>

      <pre style={{ margin: 0, fontSize: '14px', fontWeight: 800 }}>
        {pad('TOTAL:', fmt(data.total))}
      </pre>

      <pre style={{ margin: '4px 0', fontSize: '11px' }}>
        {data.paymentMethod ? pad('Payment:', data.paymentMethod.toUpperCase()) : ''}
        {data.amountPaid ? `\n${pad('Amount Paid:', fmt(data.amountPaid))}` : ''}
        {data.change !== undefined && data.change >= 0 ? `\n${pad('Change:', fmt(data.change))}` : ''}
      </pre>

      <pre style={{ margin: '4px 0' }}>{lines}</pre>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>
        <div>{data.receiptFooter || 'Thank you for your visit!'}</div>
        <div style={{ marginTop: '4px', opacity: 0.6 }}>Powered by ServePoint POS</div>
        {data.shiftId && <div style={{ opacity: 0.5 }}>Shift: {data.shiftId.slice(-8).toUpperCase()}</div>}
      </div>
    </div>
  );
};

// ─── KITCHEN ORDER TICKET (KOT / DOCKET) ─────────────────────────────────────
export const KitchenDocketTemplate: React.FC<{ data: KOTData }> = ({ data }) => {
  const lines = '='.repeat(32);

  return (
    <div style={{
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: '14px',
      width: '302px',
      margin: '0 auto',
      background: 'white',
      color: 'black',
      padding: '8px 12px',
      boxSizing: 'border-box',
      lineHeight: 1.8
    }}>
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '2px' }}>{data.hotelName.toUpperCase()}</div>
        <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '3px' }}>KITCHEN ORDER</div>
      </div>

      <pre style={{ margin: 0 }}>{lines}</pre>

      <pre style={{ margin: '4px 0', fontSize: '12px' }}>
        {`ORDER : #${data.orderNumber}`}
        {'\n'}{`TIME  : ${new Date(data.createdAt).toLocaleTimeString()}`}
        {'\n'}{`BY    : ${data.cashierName}`}
        {data.tableRef ? `\nTABLE : ${data.tableRef}` : ''}
        {data.roomNumber ? `\nROOM  : ${data.roomNumber}` : ''}
      </pre>

      <pre style={{ margin: '4px 0' }}>{lines}</pre>

      <pre style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
        {data.items.map(item => (
          `[${item.quantity}x]  ${item.name.toUpperCase()}${item.notes ? `\n      >> ${item.notes}` : ''}\n`
        )).join('\n')}
      </pre>

      <pre style={{ margin: '4px 0' }}>{lines}</pre>
      <div style={{ textAlign: 'center', fontSize: '10px' }}>--- END OF ORDER ---</div>
    </div>
  );
};

// ─── PRINT TRIGGER FUNCTIONS ──────────────────────────────────────────────────
export const printReceipt = async (data: ReceiptData) => {
  const printWindow = window.open('', '_blank', 'width=360,height=700');
  if (!printWindow) return;

  const ReactDOMServer = await import('react-dom/server');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(GuestReceiptTemplate, { data })
  );

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt - ${data.orderNumber}</title>
      <style>
        body { margin: 0; padding: 0; background: white; }
        @media print {
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};

export const printKOT = async (data: KOTData) => {
  const printWindow = window.open('', '_blank', 'width=360,height=700');
  if (!printWindow) return;

  const ReactDOMServer = await import('react-dom/server');
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(KitchenDocketTemplate, { data })
  );

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>KOT - ${data.orderNumber}</title>
      <style>
        body { margin: 0; padding: 0; background: white; }
        @media print {
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};
