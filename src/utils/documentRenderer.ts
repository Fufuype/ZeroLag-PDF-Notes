import { DocumentType } from '../types';

/**
 * Draws crisp, resolution-independent background document templates
 * directly onto a canvas at full device pixel ratio with Turkish localization.
 */
export function drawDocumentTemplate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  type: DocumentType,
  pageIndex: number = 0
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  switch (type) {
    case 'template-spec':
      drawSpecSheet(ctx, width, height, pageIndex);
      break;
    case 'template-cornell':
      drawCornellNotes(ctx, width, height);
      break;
    case 'template-grid':
      drawGridPaper(ctx, width, height);
      break;
    case 'template-lined':
      drawLinedPaper(ctx, width, height);
      break;
    default:
      drawSpecSheet(ctx, width, height, pageIndex);
  }

  ctx.restore();
}

function drawSpecSheet(ctx: CanvasRenderingContext2D, width: number, height: number, page: number) {
  const margin = Math.min(width * 0.08, 60);

  // Üst Başlık Şeridi
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(margin, margin + 40, width - margin * 2, 4);

  // Belge Başlığı
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('LENOVO AKTİF KALEM VE TABLET GRAFİK MİMARİSİ', margin, margin + 74);

  ctx.fillStyle = '#64748B';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DOKÜMAN REF: LNVO-TAB-GRAFIK-TR-V2.4  |  HEDEF DONANIM: TAB M10 / TAB P11 AES 2.0', margin, margin + 94);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, margin + 108);
  ctx.lineTo(width - margin, margin + 108);
  ctx.stroke();

  if (page === 0) {
    // Bölüm 1: Dijitalleştirici ve Düşük Gecikmeli Veri Akışı
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('1.0 AKTİF KALEM DONANIM DİJİTALLEŞTİRİCİ DÖNGÜSÜ', margin, margin + 140);

    ctx.fillStyle = '#334155';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textLines = [
      'Lenovo Precision Pen 2, 240Hz frekansta konum ve basınç bildiren Aktif Elektrostatik (AES 2.0) protokolünü kullanır.',
      'Görsel kalem ucu ile çizgi arasındaki gecikmeyi sıfıra indirmek için uygulama ağır soyutlama katmanlarını atlar',
      've doğrudan onTouchEvent içinde donanım düzeyindeki ham alt kare örneklerini (historySize) işler.',
    ];
    textLines.forEach((line, idx) => {
      ctx.fillText(line, margin, margin + 165 + idx * 20);
    });

    // Mimari Şema Kutusu
    const boxY = margin + 235;
    const boxW = width - margin * 2;
    const boxH = 120;

    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(margin, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    // Şema Düğümleri
    const nodeW = Math.min(boxW / 4 - 16, 170);
    const nodeH = 46;
    const nodeY = boxY + 38;
    const gap = (boxW - nodeW * 4) / 5;

    const stages = [
      { title: '240Hz AES Kalem', sub: 'Precision Pen 2' },
      { title: 'Dokunma Sürücüsü', sub: 'historySize tamponu' },
      { title: 'Avuç İçi Filtresi', sub: '400ms soğuma & alan' },
      { title: 'Donanım Tuvali', sub: 'quadTo & Sıfır GC' },
    ];

    stages.forEach((st, i) => {
      const nx = margin + gap + i * (nodeW + gap);
      ctx.fillStyle = i === 2 ? '#EFF6FF' : '#FFFFFF';
      ctx.strokeStyle = i === 2 ? '#3B82F6' : '#94A3B8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(nx, nodeY, nodeW, nodeH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = i === 2 ? '#1D4ED8' : '#0F172A';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.title, nx + nodeW / 2, nodeY + 20);

      ctx.fillStyle = '#64748B';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(st.sub, nx + nodeW / 2, nodeY + 35);
      ctx.textAlign = 'left';

      if (i < 3) {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '16px sans-serif';
        ctx.fillText('→', nx + nodeW + (gap - 10) / 2, nodeY + 28);
      }
    });

    // Bölüm 2: Donanım Karşılaştırma Tablosu
    const tableY = boxY + boxH + 35;
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('2.0 DONANIM KARŞILAŞTIRMA MATRİSİ: ZEROLAG VE GENEL UYGULAMALAR', margin, tableY);

    const rows = [
      ['Kriter / Kısıtlama', 'ZeroLag Yerel Motor', 'Standart PDF / Hibrit Uygulama', 'Cihaza Etkisi'],
      ['Çizim Başına Bellek Tahsisi (GC)', '0 Bayt (Önceden ayrılmış havuzlar)', '~48 KB / Kare (Iterator / Nesne)', 'Sıfır kare atlaması (0 gecikme)'],
      ['Avuç İçi Reddetme Zaman Penceresi', '400ms Hover & Dokunma Soğuması', 'Yok veya temel işletim sistemi filtresi', '%100 dinlenen el reddi'],
      ['Kapasitif Temas Eşiği Filtresi', '60.0f Temas Alanı Filtresi', 'Devre Dışı', 'Elin yan yüzeyini yoksayar'],
      ['Aktif Basınç Duyarlılığı', 'AXIS_PRESSURE Dinamik Eğri', 'Sabit Genişlik / Kademeli', 'Gerçekçi kaligrafik hat'],
      ['RAM Bellek Tüketimi', '< 38 MB (LruCache Geri Dönüşümü)', '> 180 MB (Ağır harici kütüphaneler)', '2GB RAM cihazlarda güvenli'],
    ];

    let rowY = tableY + 18;
    rows.forEach((r, rowIdx) => {
      const isHeader = rowIdx === 0;
      const rh = isHeader ? 30 : 26;

      ctx.fillStyle = isHeader ? '#F1F5F9' : rowIdx % 2 === 0 ? '#FAFAFA' : '#FFFFFF';
      ctx.fillRect(margin, rowY, boxW, rh);

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, rowY, boxW, rh);

      const colWidths = [boxW * 0.28, boxW * 0.26, boxW * 0.26, boxW * 0.2];
      let colX = margin;

      r.forEach((cell, cIdx) => {
        ctx.fillStyle = isHeader ? '#0F172A' : cIdx === 1 ? '#059669' : '#334155';
        ctx.font = isHeader
          ? 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif'
          : '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(cell, colX + 8, rowY + 17);
        colX += colWidths[cIdx];
      });

      rowY += rh;
    });

    // Alt Bilgi Kutusu
    const promptY = rowY + 30;
    ctx.fillStyle = '#FEF3C7';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(margin, promptY, boxW, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('✍️ ETKİLEŞİMLİ ANNOTASYON TUVALİ KULLANIMA HAZIR', margin + 14, promptY + 22);
    ctx.fillStyle = '#78350F';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(
      'Yukarıdaki Kalem, Vurgulayıcı veya Kement araçlarını kullanarak çizim yapabilir, renk paletinden dilediğiniz rengi seçebilir veya kendi PDF belgenizi açabilirsiniz.',
      margin + 14,
      promptY + 38
    );
  } else {
    // Sayfa 2
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('3.0 VEKTÖR YOL İNTERPOLASYONU VE BEZİER MATEMATİĞİ', margin, margin + 140);

    ctx.fillStyle = '#334155';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(
      'Her aktif kalem koordinatı, Path.quadTo() kullanılarak C1 süreklilikli bir eğriye dönüştürülür.',
      margin,
      margin + 165
    );
    ctx.fillText(
      'Orta nokta formülü: P_orta = (P_mevcut + P_onceki) / 2',
      margin,
      margin + 185
    );

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 0.8;
    for (let y = margin + 220; y < height - margin - 40; y += 32) {
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(width - margin, y);
      ctx.stroke();
    }
  }

  // Altbilgi
  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Gizli ve Tescilli  •  ZeroLag Android Motoru  •  %100 Çevrimdışı (İnternetsiz)', margin, height - 25);
  ctx.textAlign = 'right';
  ctx.fillText(`Sayfa ${page + 1} / 2`, width - margin, height - 25);
  ctx.textAlign = 'left';
}

function drawCornellNotes(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const margin = 40;
  const cueColWidth = Math.max(160, width * 0.28);
  const headerHeight = 90;
  const summaryHeight = 120;

  // Başlık Kutusu
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin, margin + 45, width - margin * 2, headerHeight);

  ctx.fillStyle = '#64748B';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('KONU / DERS BAŞLIĞI:', margin + 12, margin + 68);
  ctx.fillText('TARİH:', width - margin - 140, margin + 68);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('ZeroLag Tablet Notları ve Aktif Kalem Mimarisi', margin + 12, margin + 98);

  // Sütun dikey çizgisi
  const bodyTop = margin + 45 + headerHeight + 15;
  const bodyBottom = height - margin - summaryHeight - 15;

  ctx.strokeStyle = '#DC2626'; // Klasik kırmızı kenar boşluğu çizgisi
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(margin + cueColWidth, bodyTop);
  ctx.lineTo(margin + cueColWidth, bodyBottom);
  ctx.stroke();

  // Çizgili satırlar
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (let y = bodyTop + 28; y < bodyBottom; y += 28) {
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(width - margin, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('İPUCU & ANAHTAR KELİMELER', margin + 8, bodyTop + 18);
  ctx.fillText('NOT ALMA ALANI', margin + cueColWidth + 16, bodyTop + 18);

  // Özet Kutusu
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(margin, height - margin - summaryHeight, width - margin * 2, summaryHeight);

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('ÖZET BÖLÜMÜ', margin + 12, height - margin - summaryHeight + 20);
}

function drawGridPaper(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gridSize = 24;

  for (let x = 0; x <= width; x += gridSize) {
    const isMajor = x % (gridSize * 5) === 0;
    ctx.strokeStyle = isMajor ? '#CBD5E1' : '#F1F5F9';
    ctx.lineWidth = isMajor ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += gridSize) {
    const isMajor = y % (gridSize * 5) === 0;
    ctx.strokeStyle = isMajor ? '#CBD5E1' : '#F1F5F9';
    ctx.lineWidth = isMajor ? 1 : 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#64748B';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, monospace';
  ctx.fillText('MİMETRİK / İZOMETRİK ÇİZİM IZGARASI (5mm HASSASİYET)', 30, 85);
}

function drawLinedPaper(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const lineSpacing = 30;
  const leftMargin = 70;

  ctx.strokeStyle = '#F87171';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftMargin, 0);
  ctx.lineTo(leftMargin, height);
  ctx.stroke();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (let y = 90; y < height - 30; y += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('ÇİZGİLİ NOT DEFTERİ', leftMargin + 12, 75);
}
