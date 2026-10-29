import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { mdToDocxBody } from './docx_xml_helper.mjs';

const dir = path.resolve('xiquimvargasmanuais');
const scratchDir = path.resolve('scratch');
if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

const docMap = [
  {
    md: '01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.md',
    docx: '01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.docx',
    template: '01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '02_Runbook_Operacional_AutonomIA_ERP_2.2.1.md',
    docx: '02_Runbook_Operacional_AutonomIA_ERP_2.2.1.docx',
    template: '02_Runbook_Operacional_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '03_Engineering_Handoff_AutonomIA_ERP_2.2.1.md',
    docx: '03_Engineering_Handoff_AutonomIA_ERP_2.2.1.docx',
    template: '03_Engineering_Handoff_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.md',
    docx: '04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.docx',
    template: '04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '05_Catalogo_API_AutonomIA_ERP_2.2.1.md',
    docx: '05_Catalogo_API_AutonomIA_ERP_2.2.1.docx',
    template: '05_Catalogo_API_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.md',
    docx: '06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.docx',
    template: '06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.md',
    docx: '07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.docx',
    template: '07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.md',
    docx: '08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.docx',
    template: '08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '09_Raio_X_Engenharia_AutonomIA_ERP_2.2.1.md',
    docx: '09_Raio_X_Engenharia_AutonomIA_ERP_2.2.1.docx',
    template: '09_Raio_X_Engenharia_AutonomIA_ERP_2.2.1.docx'
  },
  {
    md: '10_Manual_Completo_Suite_APKs_Nativos_Offline.md',
    docx: '10_Manual_Completo_Suite_APKs_Nativos_Offline.docx',
    template: '01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.docx'
  }
];

console.log('=== PREPARANDO XMLS DOS DOCUMENTOS WORD (.DOCX) ===');

for (const item of docMap) {
  const mdPath = path.join(dir, item.md);
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const bodyXml = mdToDocxBody(mdContent);
  const bodyXmlPath = path.join(scratchDir, item.md + '.body.xml');
  fs.writeFileSync(bodyXmlPath, bodyXml, 'utf8');
  console.log(`-> Body XML gerado para ${item.docx} (${bodyXml.length} bytes)`);
}

// PowerShell script para extrair, costurar header + body + footer, e recriar o docx
const psScript = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$manuaisDir = Resolve-Path "xiquimvargasmanuais"
$scratchDir = Resolve-Path "scratch"

$mappings = @(
  @{ md = "01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.md"; docx = "01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.docx"; tpl = "01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "02_Runbook_Operacional_AutonomIA_ERP_2.2.1.md"; docx = "02_Runbook_Operacional_AutonomIA_ERP_2.2.1.docx"; tpl = "02_Runbook_Operacional_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "03_Engineering_Handoff_AutonomIA_ERP_2.2.1.md"; docx = "03_Engineering_Handoff_AutonomIA_ERP_2.2.1.docx"; tpl = "03_Engineering_Handoff_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.md"; docx = "04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.docx"; tpl = "04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "05_Catalogo_API_AutonomIA_ERP_2.2.1.md"; docx = "05_Catalogo_API_AutonomIA_ERP_2.2.1.docx"; tpl = "05_Catalogo_API_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.md"; docx = "06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.docx"; tpl = "06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.md"; docx = "07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.docx"; tpl = "07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.md"; docx = "08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.docx"; tpl = "08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "09_Raio_X_Engenharia_AutonomIA_ERP_2.2.1.md"; docx = "09_Raio_X_Engenharia_AutonomIA_ERP_2.2.1.docx"; tpl = "09_Raio_X_Engenharia_AutonomIA_ERP_2.2.1.docx" },
  @{ md = "10_Manual_Completo_Suite_APKs_Nativos_Offline.md"; docx = "10_Manual_Completo_Suite_APKs_Nativos_Offline.docx"; tpl = "01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.docx" }
)

foreach ($item in $mappings) {
    $targetDocx = Join-Path $manuaisDir $item.docx
    $tplDocx = Join-Path $manuaisDir $item.tpl
    $bodyXmlFile = Join-Path $scratchDir ($item.md + ".body.xml")
    $newBody = [System.IO.File]::ReadAllText($bodyXmlFile, [System.Text.Encoding]::UTF8)

    $tempDir = Join-Path $env:TEMP ("docx_build_" + [System.Guid]::NewGuid().ToString("N"))
    [System.IO.Compression.ZipFile]::ExtractToDirectory($tplDocx, $tempDir)

    $docXmlPath = Join-Path $tempDir "word\\document.xml"
    if (Test-Path $docXmlPath) {
        $origXml = [System.IO.File]::ReadAllText($docXmlPath, [System.Text.Encoding]::UTF8)
        $p1End = $origXml.IndexOf('</w:p>') + 6
        $sectIdx = $origXml.IndexOf('<w:sectPr')

        $headerXml = $origXml.Substring(0, $p1End)
        $footerXml = $origXml.Substring($sectIdx)

        $finalXml = $headerXml + [Environment]::NewLine + $newBody + [Environment]::NewLine + $footerXml
        [System.IO.File]::WriteAllText($docXmlPath, $finalXml, [System.Text.Encoding]::UTF8)
    }

    if (Test-Path $targetDocx) {
        Remove-Item $targetDocx -Force
    }

    [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $targetDocx)
    Remove-Item $tempDir -Recurse -Force
    Write-Host ("DOCX construído com sucesso: " + $item.docx)
}
`;

fs.writeFileSync('scratch/rebuild_all_docx.ps1', psScript, 'utf8');
console.log('-> Script scratch/rebuild_all_docx.ps1 gerado.');

try {
  console.log('Executando reconstrução dos arquivos .docx...');
  execSync('powershell -NoProfile -ExecutionPolicy Bypass -File scratch/rebuild_all_docx.ps1', { stdio: 'inherit' });
  console.log('=== TODOS OS ARQUIVOS .DOCX FORAM RECONSTRUÍDOS COM SUCESSO! ===');
} catch (e) {
  console.error('Erro na execução do PowerShell:', e.message);
}
