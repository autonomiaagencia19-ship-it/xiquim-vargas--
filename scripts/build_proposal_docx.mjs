import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tabela e cálculo de CRC32 padrão IEEE 802.3
const makeCrcTable = () => {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
};

const crcTable = makeCrcTable();

function getCrc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createZipArchive(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  for (const file of files) {
    const rawBuffer = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content, 'utf8');

    const crc = getCrc32(rawBuffer);
    const uncompressedSize = rawBuffer.length;

    // Deflate
    const deflated = zlib.deflateRawSync(rawBuffer, { level: 9 });
    let useMethod = 8;
    let payload = deflated;

    if (deflated.length >= uncompressedSize) {
      useMethod = 0;
      payload = rawBuffer;
    }

    const compressedSize = payload.length;
    const nameBuf = Buffer.from(file.name, 'utf8');

    // Local file header (30 bytes + name + extra)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // flags (UTF-8)
    localHeader.writeUInt16LE(useMethod, 8);  // compression method
    localHeader.writeUInt16LE(0x546A, 10);    // dosTime (10:35:20)
    localHeader.writeUInt16LE(0x5D54, 12);    // dosDate (2026-10-20)
    localHeader.writeUInt32LE(crc, 14);       // crc32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // extra len

    const localChunk = Buffer.concat([localHeader, nameBuf, payload]);
    localHeaders.push(localChunk);

    // Central Directory Header (46 bytes + name + extra + comment)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);         // version made by
    centralHeader.writeUInt16LE(20, 6);         // version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // flags
    centralHeader.writeUInt16LE(useMethod, 10); // method
    centralHeader.writeUInt16LE(0x546A, 12);    // dosTime
    centralHeader.writeUInt16LE(0x5D54, 14);    // dosDate
    centralHeader.writeUInt32LE(crc, 16);       // crc32
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // extra len
    centralHeader.writeUInt16LE(0, 32);         // comment len
    centralHeader.writeUInt16LE(0, 34);         // disk start
    centralHeader.writeUInt16LE(0, 36);         // internal attr
    centralHeader.writeUInt32LE(0, 38);         // external attr
    centralHeader.writeUInt32LE(currentOffset, 42); // local header offset

    centralHeaders.push(Buffer.concat([centralHeader, nameBuf]));

    currentOffset += localChunk.length;
  }

  const centralDirBuffer = Buffer.concat(centralHeaders);
  const cdOffset = currentOffset;
  const cdSize = centralDirBuffer.length;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);           // signature
  eocd.writeUInt16LE(0, 4);                    // disk number
  eocd.writeUInt16LE(0, 6);                    // disk start
  eocd.writeUInt16LE(files.length, 8);         // total entries on this disk
  eocd.writeUInt16LE(files.length, 10);        // total entries
  eocd.writeUInt32LE(cdSize, 12);              // central directory size
  eocd.writeUInt32LE(cdOffset, 16);            // central directory offset
  eocd.writeUInt16LE(0, 20);                   // comment len

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}

// Arquivos OpenXML do DOCX
const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

const dotRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="334155"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="140"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>

    <!-- CABEÇALHO HERO BANNER EM TABELA NAVY -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="single" w:sz="24" w:space="0" w:color="0284C7"/><w:right w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="300"/><w:bottom w:w="300"/><w:left w:w="340"/><w:right w:w="340"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="9800" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="0F172A"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:b/>
                <w:color w:val="38BDF8"/>
                <w:sz w:val="20"/>
              </w:rPr>
              <w:t>AUTONOMIA SYSTEMS TECNOLOGIA · GESTÃO INTEGRADA &amp; INOVAÇÃO COMERCIAL</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="100"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:b/>
                <w:color w:val="FFFFFF"/>
                <w:sz w:val="40"/>
              </w:rPr>
              <w:t>PROPOSTA COMERCIAL DE IMPLANTAÇÃO TECNOLÓGICA</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:color w:val="94A3B8"/>
                <w:sz w:val="22"/>
              </w:rPr>
              <w:t>Cliente Exclusivo: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:b/>
                <w:color w:val="F8FAFC"/>
                <w:sz w:val="22"/>
              </w:rPr>
              <w:t>Cantinho da Roça</w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:color w:val="94A3B8"/>
                <w:sz w:val="22"/>
              </w:rPr>
              <w:t>  |  Ref: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:color w:val="38BDF8"/>
                <w:sz w:val="22"/>
              </w:rPr>
              <w:t>PROP-AS-2026/10</w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
                <w:color w:val="94A3B8"/>
                <w:sz w:val="22"/>
              </w:rPr>
              <w:t>  |  Data: 20 de Outubro de 2026</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="240" w:after="140"/></w:pPr></w:p>

    <!-- 1. APRESENTAÇÃO -->
    <w:p>
      <w:pPr><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="28"/></w:rPr>
        <w:t>1. Apresentação &amp; Mensagem Executiva</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr><w:spacing w:after="140"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr>
        <w:t>A </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="22"/></w:rPr>
        <w:t>Autonomia Systems</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr>
        <w:t> tem a honra de apresentar esta proposta comercial especialmente elaborada para a equipe e família do </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0284C7"/><w:sz w:val="22"/></w:rPr>
        <w:t>Cantinho da Roça</w:t>
      </w:r>
      <w:r>
        <w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr>
        <w:t>. Reconhecemos o valor da tradição, do atendimento acolhedor e da qualidade dos seus produtos. Por isso, concebemos uma plataforma sob medida: intuitiva, sem jargões complicados e pronta para acabar com as perdas causadas por falta de sinal de internet, desorganização no balcão ou clientes sem atendimento.</w:t>
      </w:r>
    </w:p>

    <!-- 2. DIAGNOSTICO X SOLUÇÃO -->
    <w:p>
      <w:pPr><w:spacing w:before="200" w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="28"/></w:rPr>
        <w:t>2. Desafios do Comércio vs. Soluções Entregues</w:t>
      </w:r>
    </w:p>

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="160"/><w:right w:w="160"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="0F172A"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>DESAFIO DO DIA A DIA</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5300" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="0F172A"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>COMO A AUTONOMIA SYSTEMS RESOLVE</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="991B1B"/><w:sz w:val="20"/></w:rPr><w:t>Quedas de Internet / Instabilidade</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="7F1D1D"/><w:sz w:val="18"/></w:rPr><w:t>Internet cai e o comércio fica travado sem registrar vendas.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5300" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="20"/></w:rPr><w:t>Aplicativos 100% Offline Real</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="18"/></w:rPr><w:t>O sistema continua vendendo normalmente sem sinal. Ao voltar a internet, sincroniza tudo sozinho sem duplicar.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="991B1B"/><w:sz w:val="20"/></w:rPr><w:t>Demora e Fila no Balcão</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="7F1D1D"/><w:sz w:val="18"/></w:rPr><w:t>Cálculo manual de troco, lentidão e risco de erro de caixa.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5300" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="20"/></w:rPr><w:t>PDV Ágil &amp; Leitor de Código de Barras</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="18"/></w:rPr><w:t>Bipagem rápida, busca por toque, cálculo automático de troco e impressão imediata de comprovante.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="991B1B"/><w:sz w:val="20"/></w:rPr><w:t>Vendas Perdidas Fora de Hora</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="7F1D1D"/><w:sz w:val="18"/></w:rPr><w:t>Cliente chama à noite no WhatsApp e ninguém responde a tempo.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5300" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="20"/></w:rPr><w:t>Loja Online + Max Atendente 24h</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="18"/></w:rPr><w:t>Sua loja na internet aberta 24h e atendente com inteligência artificial para anotar pedidos e tirar dúvidas.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FEF2F2"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="991B1B"/><w:sz w:val="20"/></w:rPr><w:t>Furo de Estoque e Falta de Produto</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="7F1D1D"/><w:sz w:val="18"/></w:rPr><w:t>Produto acaba na prateleira sem o dono perceber a tempo.</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="5300" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="20"/></w:rPr><w:t>Baixa Automática &amp; Alerta de Reposição</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="18"/></w:rPr><w:t>Baixa instantânea em cada venda e lista em destaque com os produtos que estão no estoque mínimo.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="240" w:after="140"/></w:pPr></w:p>

    <!-- 3. ESCOPO DA SOLUÇÃO -->
    <w:p>
      <w:pPr><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="28"/></w:rPr>
        <w:t>3. Escopo Detalhado da Solução Entregue</w:t>
      </w:r>
    </w:p>

    <!-- CARD 1: LOJA ONLINE -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="single" w:sz="24" w:space="0" w:color="0284C7"/><w:bottom w:val="none"/><w:right w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="200"/><w:right w:w="200"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="0284C7"/><w:sz w:val="24"/></w:rPr><w:t>🌐 3.1. Loja Online Própria (Vitrine Digital Web &amp; Mobile)</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Sua empresa ganha uma vitrine na web moderna e personalizada com fotos, categorias e preços de todos os produtos do Cantinho da Roça. Seus clientes podem acessar a qualquer hora do dia ou da noite pelo celular ou computador, escolher os itens e enviar os pedidos de forma rápida e organizada.</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="20"/></w:rPr><w:t>Vantagem Exclusiva: </w:t></w:r>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="20"/></w:rPr><w:t>100% do lucro é seu. Sem cobrança de comissões por pedido (ao contrário de aplicativos que cobram 25% a 30% das suas vendas).</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="100" w:after="60"/></w:pPr></w:p>

    <!-- CARD 2: APLICATIVOS ANDROID OFFLINE -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="single" w:sz="24" w:space="0" w:color="10B981"/><w:bottom w:val="none"/><w:right w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="200"/><w:right w:w="200"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F0FDF4"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="059669"/><w:sz w:val="24"/></w:rPr><w:t>📱 3.2. Aplicativos Celular Android (Funcionam até SEM Internet)</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Aplicativos nativos e velozes instalados direto no celular ou tablet de quem vende ou atende. O grande diferencial tecnológico: </w:t></w:r>
            <w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="22"/></w:rPr><w:t>se faltar luz ou a internet cair na sua região, o sistema NÃO para.</w:t></w:r>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t> Você continua consultando produtos, fazendo vendas e atendendo clientes. Assim que a conexão for restabelecida, todos os dados são sincronizados automaticamente em nuvem com chave anti-duplicação.</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="100" w:after="60"/></w:pPr></w:p>

    <!-- CARD 3: FRENTE DE CAIXA E ESTOQUE -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="single" w:sz="24" w:space="0" w:color="F59E0B"/><w:bottom w:val="none"/><w:right w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="200"/><w:right w:w="200"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="FFFBEB"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="D97706"/><w:sz w:val="24"/></w:rPr><w:t>🛒 3.3. Frente de Caixa (PDV) &amp; Estoque Inteligente</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Registro de vendas em poucos toques, suporte a leitor de código de barras USB/Bluetooth, cálculo automático de troco e impressão de comprovantes (térmica 58mm/80mm ou PDF). O estoque diminui na hora a cada venda feita no balcão ou na loja online, disparando alertas imediatos dos produtos que precisam de reposição.</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="100" w:after="60"/></w:pPr></w:p>

    <!-- CARD 4: GESTAO DE CLIENTES E TORRE DE CONTROLE -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="single" w:sz="24" w:space="0" w:color="6366F1"/><w:bottom w:val="none"/><w:right w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="200"/><w:right w:w="200"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="EEF2FF"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="4F46E5"/><w:sz w:val="24"/></w:rPr><w:t>👥 3.4. Cadastro de Clientes &amp; Torre de Controle do Proprietário</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Tenha o telefone, endereço e histórico de compras de cada cliente na palma das mãos. Pela Torre de Controle Gerencial no celular ou computador, o dono acompanha o faturamento do dia, pedidos em separação e o ranking com os 20 produtos campeões de venda.</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="240" w:after="140"/></w:pPr></w:p>

    <!-- 4. SEÇÃO BRINDE: MAX ATENDENTE -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="18" w:space="0" w:color="10B981"/>
          <w:left w:val="single" w:sz="18" w:space="0" w:color="10B981"/>
          <w:bottom w:val="single" w:sz="18" w:space="0" w:color="10B981"/>
          <w:right w:val="single" w:sz="18" w:space="0" w:color="10B981"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="220"/><w:bottom w:w="220"/><w:left w:w="260"/><w:right w:w="260"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="ECFDF5"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="20"/></w:rPr><w:t>🎁 BÔNUS EXCLUSIVO DE FECHAMENTO (100% GRATUITO)</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="80"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="059669"/><w:sz w:val="30"/></w:rPr><w:t>Max Atendente Inteligente no WhatsApp 24 Horas</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="80"/></w:pPr>
            <w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="22"/></w:rPr><w:t>Como brinde especial nesta negociação, entregamos pronto e configurado o atendente virtual </w:t></w:r>
            <w:r><w:rPr><w:b/><w:color w:val="064E3B"/><w:sz w:val="22"/></w:rPr><w:t>Max</w:t></w:r>
            <w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="22"/></w:rPr><w:t> integrado ao número oficial de WhatsApp do Cantinho da Roça.</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="22"/></w:rPr><w:t>• Atendimento Ininterrupto: </w:t></w:r>
            <w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="22"/></w:rPr><w:t>atende clientes 24h por dia, 7 dias por semana, inclusive domingos e feriados.</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="22"/></w:rPr><w:t>• Resposta Instantânea a Dúvidas: </w:t></w:r>
            <w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="22"/></w:rPr><w:t>informa horários, localização, formas de pagamento e produtos disponíveis.</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="065F46"/><w:sz w:val="22"/></w:rPr><w:t>• Catálogo &amp; Pré-Pedidos: </w:t></w:r>
            <w:r><w:rPr><w:color w:val="064E3B"/><w:sz w:val="22"/></w:rPr><w:t>envia catálogo na conversa e anota os pedidos dos clientes para você não perder vendas.</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="240" w:after="140"/></w:pPr></w:p>

    <!-- 5. CRONOGRAMA E GARANTIA -->
    <w:p>
      <w:pPr><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="28"/></w:rPr>
        <w:t>5. Implantação, Treinamento Prático e Garantia</w:t>
      </w:r>
    </w:p>

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="160"/><w:bottom w:w="160"/><w:left w:w="200"/><w:right w:w="200"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="4900" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="0284C7"/><w:sz w:val="24"/></w:rPr><w:t>🛠️ 7 Dias de Implantação Guiada</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Cuidamos da configuração técnica, parametrização da loja e cadastro inicial dos produtos. Acompanhamos sua equipe lado a lado, ensinando na prática até que todos estejam totalmente seguros para o uso diário.</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="4900" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="60"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="059669"/><w:sz w:val="24"/></w:rPr><w:t>🛡️ 30 Dias de Garantia Total &amp; Suporte</w:t></w:r>
          </w:p>
          <w:p>
            <w:pPr><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Após a instalação, você conta com suporte prioritário direto com os desenvolvedores para tirar dúvidas, fazer pequenos ajustes finos e garantir que a operação rode perfeitamente na rotina do comércio.</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="240" w:after="140"/></w:pPr></w:p>

    <!-- 6. TABELA DE INVESTIMENTO FINANCEIRO -->
    <w:p>
      <w:pPr><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="28"/></w:rPr>
        <w:t>6. Investimento e Condições de Pagamento</w:t>
      </w:r>
    </w:p>

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="0F172A"/>
          <w:left w:val="none"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="0F172A"/>
          <w:right w:val="none"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="160"/><w:bottom w:w="160"/><w:left w:w="180"/><w:right w:w="180"/></w:tblCellMar>
      </w:tblPr>

      <!-- CABEÇALHO TABELA -->
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="0F172A"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>ITEM / COMPONENTE DA SOLUÇÃO</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="0F172A"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>CONDIÇÃO / VENCIMENTO</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="0F172A"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>VALOR (R$)</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- LINHA 1: VALOR TOTAL -->
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="22"/></w:rPr><w:t>Pacote Completo Chave na Mão</w:t></w:r><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
          <w:p><w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr><w:t>ERP Central + Loja Online + Apps Android + 7d Implantação + 30d Suporte + Bônus Max WhatsApp</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:r><w:rPr><w:b/><w:color w:val="0284C7"/><w:sz w:val="22"/></w:rPr><w:t>Investimento Total</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="26"/></w:rPr><w:t>R$ 1.500,00</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- LINHA 2: ENTRADA -->
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5400" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Entrada Facilitada (50% do total)</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>Na assinatura do contrato</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0284C7"/><w:sz w:val="22"/></w:rPr><w:t>R$ 750,00</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- LINHA 3: 1ª PARCELA -->
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>1ª Parcela do Saldo Restante (25%)</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>30 dias após a assinatura</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="059669"/><w:sz w:val="22"/></w:rPr><w:t>R$ 375,00</w:t></w:r></w:p>
        </w:tc>
      </w:tr>

      <!-- LINHA 4: 2ª PARCELA -->
      <w:tr>
        <w:tc>
          <w:tcPr><w:tcW w:w="5400" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>2ª Parcela do Saldo Restante (Quitação 25%)</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>
          <w:p><w:r><w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr><w:t>60 dias após a assinatura</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="059669"/><w:sz w:val="22"/></w:rPr><w:t>R$ 375,00</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:pPr><w:spacing w:before="300" w:after="160"/></w:pPr></w:p>

    <!-- 7. VALIDAÇÃO E ACEITE -->
    <w:p>
      <w:pPr><w:spacing w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="28"/></w:rPr>
        <w:t>7. Validação e Aceite da Proposta</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:spacing w:after="240"/></w:pPr>
      <w:r>
        <w:rPr><w:color w:val="334155"/><w:sz w:val="22"/></w:rPr>
        <w:t>Estando as partes plenamente de acordo com as especificações, escopo e condições comerciais discriminadas neste instrumento, firmam o presente aceite para início imediato dos trabalhos de implantação técnica no Cantinho da Roça.</w:t>
      </w:r>
    </w:p>

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9800" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="100"/><w:bottom w:w="100"/><w:left w:w="100"/><w:right w:w="100"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <!-- ASSINATURA CLIENTE -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>_____________________________________________</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="0F172A"/><w:sz w:val="22"/></w:rPr><w:t>CANTINHO DA ROÇA</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>Aceite do Cliente</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:color w:val="94A3B8"/><w:sz w:val="18"/></w:rPr><w:t>Data: ____ / ____ / 2026</w:t></w:r>
          </w:p>
        </w:tc>

        <!-- ESPAÇO -->
        <w:tc><w:tcPr><w:tcW w:w="200" w:type="dxa"/></w:tcPr><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>

        <!-- ASSINATURA AUTONOMIA SYSTEMS -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>_____________________________________________</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:b/><w:color w:val="0284C7"/><w:sz w:val="22"/></w:rPr><w:t>AUTONOMIA SYSTEMS TECNOLOGIA</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r><w:rPr><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>Diretoria de Tecnologia &amp; Operações</w:t></w:r>
          </w:p>
          <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r><w:rPr><w:color w:val="94A3B8"/><w:sz w:val="18"/></w:rPr><w:t>Validação Comercial &amp; Técnica</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

  </w:body>
</w:document>`;

const filesToZip = [
  { name: '[Content_Types].xml', content: contentTypesXml },
  { name: '_rels/.rels', content: dotRelsXml },
  { name: 'word/_rels/document.xml.rels', content: docRelsXml },
  { name: 'word/settings.xml', content: settingsXml },
  { name: 'word/styles.xml', content: stylesXml },
  { name: 'word/document.xml', content: documentXml }
];

const zipBuffer = createZipArchive(filesToZip);

// Salvar no diretório raiz do projeto
const destDocx = path.resolve(__dirname, '..', 'PROPOSTA_COMERCIAL_CANTINHO_DA_ROCA.docx');
fs.writeFileSync(destDocx, zipBuffer);

console.log(`[SUCESSO] Arquivo DOCX gerado com sucesso em: ${destDocx}`);
console.log(`Tamanho final: ${zipBuffer.length} bytes`);
