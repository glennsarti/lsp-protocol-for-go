param(
  [Switch]$Clean
)

$PLSVersion = 'gopls/v0.6.11'
$DownloadURL = "https://github.com/golang/tools/archive/refs/tags/$PLSVersion.zip"
$rootNamespace = 'github.com/glennsarti/jsonrpc-protocol-for-go'
$DestRoot = $PSScriptRoot
$ExtractDir = Join-Path -Path $ENV:TEMP -ChildPath 'gopls-revendor'

# Munge Content
function Invoke-MungeGolang($Filename) {
  Write-Host "Munging $Filename ..."
  $FileContent = Get-Content -Path $Filename -Raw
  $FileContent = $FileContent.Replace('"golang.org/x/tools/internal/', "`"$rootNamespace/")
  [System.IO.File]::WriteAllText($Filename, $FileContent)
}

# Download and extract Golang tools
if ($Clean -or !(Test-Path -Path $ExtractDir)) {
  Write-Host "Downloading GoLang Tools version $PLSVersion ..."
  $TempZIP = Join-Path -Path $ENV:TEMP -ChildPath 'gopls.zip'
  if (Test-Path -Path $TempZIP) { Remove-Item -Path $TempZIP -Force -Confirm:$false | Out-Null }
  Invoke-WebRequest -URI $DownloadURL -UseBasicParsing -OutFile $TempZIP

  Write-Host "Extracting ZIP file ..."
  if (Test-Path -Path $ExtractDir) { Remove-Item -Path $ExtractDir -Force -Confirm:$false -Recurse | Out-Null }
  Expand-Archive -Path $TempZIP -DestinationPath $ExtractDir -Force
}

$rootExtract = Get-ChildItem -Path $ExtractDir -Directory | Select-Object -First 1
$SrcInternalDir = Join-Path -Path $rootExtract -ChildPath 'internal'

# Clean the destination directories
Write-Host "Cleaning the output directories..."
$TypeScriptDir = Join-Path $DestRoot 'typescript'
$StaticDir = Join-Path $DestRoot 'static'
if (Test-Path -Path $TypeScriptDir) { Remove-Item -Path $TypeScriptDir -Force -Confirm:$false -Recurse | Out-Null }
if (Test-Path -Path $StaticDir) { Remove-Item -Path $StaticDir -Force -Confirm:$false -Recurse | Out-Null }
New-Item $TypeScriptDir -ItemType Directory -Force -Confirm:$false | Out-Null
New-Item $StaticDir -ItemType Directory -Force -Confirm:$false | Out-Null

# Copy the typescript converter
Write-Host "Copying the typescript converter ..."
Copy-Item -Path (Join-Path $SrcInternalDir 'lsp/protocol/typescript/*.*') -Destination $TypeScriptDir -Recurse -Force | Out-Null
Get-ChildItem -Path $DestRoot -Filter '*.ts' -Recurse | ForEach-Object { Invoke-MungeGolang -Filename $_.FullName }


# Copy any static files
# Note we don't copy the same path otherwise Go will try and parse the file and throw errors.
@(
  @{ Source = 'lsp/protocol/protocol.go'; Destination = 'protocol_go.txt' }
  @{ Source = 'lsp/protocol/enums.go'; Destination = 'enums_go.txt' }
) | ForEach-Object {
  Write-Host "Copying static file $($_.Source) ..."
  $DestPath = (Join-Path -Path $StaticDir $_.Destination)
  Copy-Item -Path (Join-Path $SrcInternalDir $_.Source) -Destination $DestPath -Force -Confirm:$False | Out-Null
  Invoke-MungeGolang -Filename $DestPath
}
