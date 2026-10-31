import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  Download,
  X,
  CheckCircle2,
  Share2,
  Copy,
  Check,
  Building2,
  Calendar,
  MapPin,
  Car,
  Compass,
  CreditCard,
  ShieldCheck,
  FileText,
  Loader2,
  Mail
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { bookingsAPI } from '../../services/api';

const DEFAULT_COMPANY = {
  legalName: 'CARZODRIVE LUXURY MOBILITY & TOURS PRIVATE LIMITED',
  tradeName: 'CARZODRIVE',
  address: 'Plot No. 42, Airport Square, Master Canteen, Bhubaneswar, Odisha - 751001, India',
  gstin: '21AAACC1234D1Z5',
  cin: 'U50100OR2026PTC045812',
  pan: 'AAACC1234D',
  state: 'Odisha',
  stateCode: '21',
  supportPhone: '+91 79780 00000',
  supportEmail: 'concierge@carzodrive.com',
  website: 'www.carzodrive.com',
  sacCarRental: '996411',
  sacTourOperator: '998553',
};

// Compact Indian Rupees Number to Words helper
function numberToWordsINR(num) {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    if (val < 20) return a[val];
    const digit = val % 10;
    return b[Math.floor(val / 10)] + (digit ? ' ' + a[digit] : '');
  }

  let str = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (crore) str += inWords(crore) + ' Crore ';
  if (lakh) str += inWords(lakh) + ' Lakh ';
  if (thousand) str += inWords(thousand) + ' Thousand ';
  if (hundred) str += inWords(hundred) + ' Hundred ';
  if (rest) str += (str ? 'and ' : '') + inWords(rest) + ' ';

  return 'Rupees ' + str.trim() + ' Only';
}

export const InvoiceModal = ({ isOpen, onClose, booking, bookingIdOrCode }) => {
  const [invoiceData, setInvoiceData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (booking) {
      setInvoiceData({
        company: DEFAULT_COMPANY,
        invoiceNumber: booking.invoiceNumber || `INV-${(booking.bookingNumber || '').replace(/^CZ-/, '') || booking._id}`,
        invoiceDate: booking.invoiceDate || booking.createdAt || new Date(),
        booking,
      });
    } else if (bookingIdOrCode) {
      setIsLoading(true);
      bookingsAPI.getInvoice(bookingIdOrCode)
        .then((res) => {
          setInvoiceData(res?.data || res);
        })
        .catch((err) => {
          console.warn('Failed to load remote invoice, using fallback:', err);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, booking, bookingIdOrCode]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const b = invoiceData?.booking || booking;
  const company = invoiceData?.company || DEFAULT_COMPANY;

  if (!b && isLoading) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-3xl shadow-2xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-zinc-900">Preparing Official Tax Invoice...</span>
        </div>
      </div>,
      document.body
    );
  }

  if (!b) return null;

  const total = Math.max(0, Number(b.totalAmount || b.priceBreakdown?.totalAmount || 0));

  const isOffline =
    b.paymentMode === 'offline' ||
    b.paymentStatus === 'OFFLINE_PENDING' ||
    b.transactionId === 'PAY_ON_PICKUP';
  const isExplicitlyPaid = b.paymentStatus === 'PAID';
  const isPartiallyPaid = b.paymentStatus === 'PARTIALLY_PAID' || b.paymentMode === 'partial';

  let paid = 0;
  if (isOffline && !isExplicitlyPaid) {
    paid = 0;
  } else if (b.paidAmount !== undefined && b.paidAmount !== null && !isNaN(Number(b.paidAmount))) {
    paid = Math.max(0, Number(b.paidAmount));
    if (paid === 0 && isExplicitlyPaid && !isOffline) {
      paid = total;
    }
  } else if (isExplicitlyPaid && !isOffline) {
    paid = total;
  } else if (isPartiallyPaid && !isOffline) {
    paid = Math.max(0, Number(b.paidAmount || Math.round(total * 0.25)));
  } else {
    paid = 0;
  }

  if (total > 0 && paid > total) {
    paid = total;
  }

  let balance = 0;
  if (b.balanceAmount !== undefined && b.balanceAmount !== null && !isNaN(Number(b.balanceAmount))) {
    const rawBalance = Number(b.balanceAmount);
    balance = (isOffline && !isExplicitlyPaid && rawBalance === 0 && total > 0) ? total : Math.max(0, rawBalance);
  } else {
    balance = Math.max(0, total - paid);
  }

  const deposit = Number(b.securityDeposit || b.priceBreakdown?.securityDeposit || 0);

  const isTour =
    b.serviceType?.toLowerCase().includes('tour') ||
    b.serviceType?.toLowerCase().includes('package') ||
    Boolean(b.packageId);

  // Compute GST components (5% for tour packages, 18% for vehicle rentals)
  const gstRate = isTour ? 5 : 18;
  const baseRate = Math.round(total / (1 + gstRate / 100));
  const gstAmount = Math.max(0, total - baseRate);
  const cgst = Math.round(gstAmount / 2);
  const sgst = gstAmount - cgst;

  const invoiceNum =
    b.invoiceNumber ||
    invoiceData?.invoiceNumber ||
    `INV-${(b.bookingNumber || '').replace(/^CZ-/, '') || b._id}`;

  const formattedDate = new Date(b.invoiceDate || b.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // 1. Direct PDF file generation and download using html2pdf
  const handleDownloadPdf = async () => {
    const printable = document.getElementById('carzodrive-printable-invoice');
    if (!printable) return;

    setIsDownloadingPdf(true);
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const opt = {
        margin: [10, 8, 10, 8],
        filename: `CARZODRIVE-Tax-Invoice-${invoiceNum}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 1024,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      await html2pdf().set(opt).from(printable).save();
    } catch (err) {
      console.error('Direct PDF download failed, using print fallback:', err);
      handlePrint();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // 2. High-fidelity isolated iframe print (prevents modal scroll/clipping bugs)
  const handlePrint = () => {
    const printable = document.getElementById('carzodrive-printable-invoice');
    if (!printable) return;

    const oldIframe = document.getElementById('carzodrive-print-frame');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'carzodrive-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1024px';
    iframe.style.height = '1400px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;

    // Collect all stylesheets from main document
    const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CARZODRIVE Tax Invoice - ${invoiceNum}</title>
          ${styleTags}
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 8mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              color: #18181b !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #carzodrive-printable-invoice {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          </style>
        </head>
        <body class="bg-white p-4">
          <div id="carzodrive-printable-invoice" class="space-y-6">
            ${printable.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        iframe.remove();
      }, 1000);
    }, 400);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/my-bookings?code=${b.bookingNumber || b._id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleResendEmail = async () => {
    const targetCode = b.bookingNumber || b._id;
    if (!targetCode) return;
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const email = b.guestEmail || b.customerId?.email;
      await bookingsAPI.resendEmail(targetCode, email);
      setEmailStatus({ type: 'success', message: 'Email sent!' });
      setTimeout(() => setEmailStatus(null), 4000);
    } catch (err) {
      setEmailStatus({ type: 'error', message: err.message || 'Failed to dispatch email' });
      setTimeout(() => setEmailStatus(null), 5000);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return createPortal(
    <div className="invoice-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
      {/* Print-specific CSS styles */}
      <style>{`
        @media print {
          #root, .invoice-no-print {
            display: none !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .invoice-modal-overlay {
            position: static !important;
            inset: auto !important;
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
          }
          .invoice-modal-card {
            position: static !important;
            display: block !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            max-height: none !important;
          }
          .invoice-modal-scroll {
            display: block !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            max-height: none !important;
          }
          #carzodrive-printable-invoice {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 8mm;
          }
        }
      `}</style>

      <div className="invoice-modal-card relative w-full max-w-4xl my-auto bg-zinc-100 rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Top Floating Action Header (Hidden during Print) */}
        <div className="invoice-no-print px-5 py-3.5 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate flex items-center gap-2">
                <span>Tax Invoice & Travel Voucher</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {invoiceNum}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">
                Official CarzoDrive Travel Document • Bhubaneswar Hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy link to this booking"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-colors cursor-pointer border border-zinc-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>

            {/* Email Tax Invoice directly to customer */}
            <button
              type="button"
              disabled={isSendingEmail}
              onClick={handleResendEmail}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                emailStatus?.type === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : emailStatus?.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-emerald-700/80 hover:bg-emerald-600 text-white border-emerald-600'
              } disabled:opacity-60`}
              title="Send/Resend Official Tax Invoice & Voucher to customer email"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Emailing...</span>
                </>
              ) : emailStatus?.type === 'success' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Email Sent!</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Invoice</span>
                </>
              )}
            </button>

            {/* Direct PDF File Download */}
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-60"
              title="Download Tax Invoice directly as a PDF file"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Isolated High-Fidelity Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold transition-all cursor-pointer border border-zinc-700"
              title="Open browser print dialog"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-300" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close invoice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Invoice Content */}
        <div className="invoice-modal-scroll overflow-y-auto p-3 sm:p-6 bg-zinc-100 flex-1">
          <div
            id="carzodrive-printable-invoice"
            className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-9 shadow-sm border border-zinc-200 text-zinc-900 mx-auto max-w-3xl space-y-6"
          >
            {/* Header: Company Identity & Tax Invoice Title */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pb-6 border-b-2 border-zinc-900">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-black text-xs">
                    CZ
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950">
                    CARZODRIVE
                  </h1>
                </div>
                <p className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                  {company.legalName}
                </p>
                <p className="text-[11px] text-zinc-600 max-w-sm leading-relaxed">
                  {company.address}
                </p>
                <div className="pt-1 text-[10px] text-zinc-500 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                  <span><strong>GSTIN:</strong> {company.gstin}</span>
                  <span><strong>PAN:</strong> {company.pan}</span>
                  <span><strong>CIN:</strong> {company.cin}</span>
                  <span><strong>State Code:</strong> 21 (Odisha)</span>
                </div>
              </div>

              <div className="text-left sm:text-right space-y-1 shrink-0">
                <div className="inline-block px-3 py-1 rounded-lg bg-zinc-950 text-white font-black text-xs uppercase tracking-widest">
                  TAX INVOICE
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  ORIGINAL FOR RECIPIENT
                </p>
                <div className="pt-2 text-xs font-mono space-y-0.5">
                  <p className="font-bold text-zinc-950">
                    Invoice No: <span className="text-blue-700">{invoiceNum}</span>
                  </p>
                  <p className="text-zinc-600">Date: {formattedDate}</p>
                  <p className="text-zinc-600">Booking Ref: <strong className="text-zinc-900">{b.bookingNumber || b._id}</strong></p>
                </div>
              </div>
            </div>

            {/* Invoice Meta & Billed To Section (2-Column Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs">
              <div className="space-y-1">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 pb-1 border-b border-zinc-200">
                  Billed To (Passenger / Guest)
                </h4>
                <p className="font-bold text-sm text-zinc-950 pt-0.5">
                  {b.guestName || b.customerId?.name || 'Valued Guest'}
                </p>
                {b.guestPhone && (
                  <p className="text-zinc-700 font-mono">
                    Phone: {b.guestPhone}
                  </p>
                )}
                {b.guestEmail && (
                  <p className="text-zinc-700 font-mono">
                    Email: {b.guestEmail}
                  </p>
                )}
                <p className="text-zinc-500 text-[11px]">
                  Place of Supply: <strong>Odisha (State Code: 21)</strong>
                </p>
              </div>

              <div className="space-y-1 sm:border-l sm:border-zinc-200 sm:pl-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 pb-1 border-b border-zinc-200">
                  Trip & Payment Ledger Summary
                </h4>
                <div className="text-xs space-y-1 pt-0.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Payment Status:</span>
                    <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${
                      paid >= total && total > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : paid > 0
                        ? 'bg-amber-100 text-amber-800'
                        : isOffline
                        ? 'bg-amber-50 text-amber-900 border border-amber-300'
                        : 'bg-zinc-200 text-zinc-800'
                    }`}>
                      {paid >= total && total > 0
                        ? 'PAID'
                        : paid > 0
                        ? 'PARTIALLY PAID'
                        : isOffline
                        ? 'PAY ON PICKUP (PENDING)'
                        : (b.paymentStatus?.replace('_', ' ') || 'PENDING')}
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-zinc-500">Receipt Ref:</span>
                    <span className="font-bold text-zinc-900">{b.paymentId?.paymentNumber || (isOffline ? 'PAY-ON-PICKUP' : 'PAY-ONLINE')}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-zinc-500">Transaction ID:</span>
                    <span className="font-bold text-zinc-900 truncate max-w-[150px]">{b.transactionId || (isOffline ? 'PAY_ON_PICKUP' : 'ONLINE_GATEWAY')}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-500">Payment Mode:</span>
                    <span className="font-bold uppercase text-zinc-800">
                      {b.paymentMode === 'offline' ? 'Pay on Pickup' : b.paymentMode === 'partial' ? '25% Partial Advance' : (b.paymentMode || '100% Online')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Travel / Tour Itinerary & Schedule Box */}
            <div className="p-4 rounded-2xl border border-zinc-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {isTour ? 'TOUR PACKAGE RESERVATION' : 'MOBILITY SERVICE'}
                  </span>
                  <h3 className="font-black text-sm text-zinc-950">
                    {b.vehicleName || (isTour ? 'Odisha Tour Package' : 'Fleet Rental')}
                  </h3>
                </div>
                <span className="text-xs font-bold text-zinc-500">
                  SAC Code: <strong>{isTour ? company.sacTourOperator : company.sacCarRental}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Schedule Period</span>
                  <span className="font-bold text-zinc-900">
                    {b.pickupDate || 'Start'} → {b.returnDate || 'Return'}
                  </span>
                  <span className="block text-[11px] text-zinc-500">
                    Duration: {b.days || 1} {b.days === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Pick-up Location</span>
                  <span className="font-bold text-zinc-900">{b.pickupLocation || 'Bhubaneswar Hub'}</span>
                </div>

                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase font-bold">Drop-off Location</span>
                  <span className="font-bold text-zinc-900">{b.dropoffLocation || 'Same as Pickup'}</span>
                </div>
              </div>

              {b.includeProtection && (
                <div className="pt-1 text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Comprehensive Zero-Excess Damage Protection Plan Included</span>
                </div>
              )}
            </div>

            {/* Itemized Tax Invoice Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-900 bg-zinc-50 text-zinc-900">
                    <th className="py-2.5 px-3 font-black uppercase tracking-wider text-[10px]">#</th>
                    <th className="py-2.5 px-3 font-black uppercase tracking-wider text-[10px]">Description of Supply / Service</th>
                    <th className="py-2.5 px-3 font-black uppercase tracking-wider text-[10px]">SAC</th>
                    <th className="py-2.5 px-3 font-black uppercase tracking-wider text-[10px] text-center">Qty</th>
                    <th className="py-2.5 px-3 font-black uppercase tracking-wider text-[10px] text-right">Taxable Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  <tr>
                    <td className="py-3 px-3 font-mono text-zinc-500">1</td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-zinc-950">
                        {b.vehicleName || (isTour ? 'Tour Package Reservation' : 'Self-Drive Vehicle Rental')}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {isTour
                          ? 'Sightseeing, sanitized transport, dedicated driver & toll/parking allowances'
                          : `Rental fare for ${b.days || 1} day(s) from ${b.pickupDate || ''} to ${b.returnDate || ''}`}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-600">{isTour ? company.sacTourOperator : company.sacCarRental}</td>
                    <td className="py-3 px-3 text-center font-bold">{b.days || 1}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-zinc-950">
                      ₹{baseRate.toLocaleString('en-IN')}
                    </td>
                  </tr>

                  {b.includeProtection && (
                    <tr>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">2</td>
                      <td className="py-2.5 px-3 font-medium text-zinc-800">
                        Zero-Excess Damage Waiver & 24x7 Roadside Assistance
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-600">997139</td>
                      <td className="py-2.5 px-3 text-center font-bold">1</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-950">
                        ₹499
                      </td>
                    </tr>
                  )}

                  {deposit > 0 && (
                    <tr>
                      <td className="py-2.5 px-3 font-mono text-zinc-500">3</td>
                      <td className="py-2.5 px-3 text-zinc-700">
                        Refundable Security Deposit (Non-Taxable Capital Advance)
                      </td>
                      <td className="py-2.5 px-3 font-mono text-zinc-400">—</td>
                      <td className="py-2.5 px-3 text-center font-bold">1</td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-700">
                        ₹{deposit.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations & Taxes Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2">
              <div className="sm:col-span-7 space-y-2">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Total Amount in Words:
                  </span>
                  <p className="text-xs font-black text-zinc-900 pt-0.5 italic">
                    {numberToWordsINR(total)}
                  </p>
                </div>

                <div className="text-[10px] text-zinc-500 space-y-0.5 pt-1">
                  <p>• GST Reverse Charge: <strong>NO</strong></p>
                  <p>• State of Origin: <strong>Odisha (21)</strong> • Place of Supply: <strong>Odisha (21)</strong></p>
                </div>
              </div>

              <div className="sm:col-span-5 bg-zinc-50 p-4 rounded-2xl border border-zinc-200 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-zinc-600">
                  <span>Taxable Subtotal:</span>
                  <span className="font-bold text-zinc-900">₹{baseRate.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between text-zinc-600 text-[11px]">
                  <span>CGST @ {(gstRate / 2).toFixed(1)}%:</span>
                  <span>₹{cgst.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between text-zinc-600 text-[11px]">
                  <span>SGST @ {(gstRate / 2).toFixed(1)}%:</span>
                  <span>₹{sgst.toLocaleString('en-IN')}</span>
                </div>

                <div className="flex justify-between font-black text-sm text-zinc-950 border-t-2 border-zinc-900 pt-1.5 mt-1.5">
                  <span className="font-sans">Grand Total:</span>
                  <span>₹{total.toLocaleString('en-IN')}</span>
                </div>

                <div className={`flex justify-between font-bold border-t border-zinc-200 pt-1 text-[11px] ${paid > 0 ? 'text-emerald-700' : 'text-zinc-500'}`}>
                  <span>Advance Received:</span>
                  <span>₹{paid.toLocaleString('en-IN')}</span>
                </div>

                <div className={`flex justify-between font-bold text-[11px] ${balance > 0 ? 'text-amber-700' : 'text-zinc-500'}`}>
                  <span>Balance Payable at Handover:</span>
                  <span>₹{balance.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Bottom Sign-off, Seal & Legal Declarations */}
            <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-end justify-between gap-6 text-xs">
              <div className="space-y-1 text-[10px] text-zinc-500 max-w-sm">
                <p className="font-bold text-zinc-700 uppercase tracking-wider">Terms & Customer Declaration:</p>
                <p>1. Valid Govt. Photo ID (Aadhaar / Passport) is required before departure or vehicle handover.</p>
                <p>2. Tolls, parking, and state permits are processed as per booking inclusions.</p>
                <p>3. 24x7 Customer Support & Roadside Helpline: <strong>+91 79780 00000</strong>.</p>
                <p className="italic pt-1">This is a computer-generated Tax Invoice and requires no physical signature.</p>
              </div>

              <div className="text-right space-y-2 shrink-0">
                <div className="inline-block p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold text-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto mb-0.5" />
                  <span>DIGITALLY VERIFIED INVOICE</span>
                </div>
                <div className="pt-2">
                  <p className="text-[10px] text-zinc-500">For <strong>CARZODRIVE LUXURY MOBILITY & TOURS</strong></p>
                  <p className="font-black text-xs text-zinc-950 pt-6">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
