param([string] $Python = 'python')
$ErrorActionPreference = 'Stop'
& $Python -c 'import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,13) else 1)'
if ($LASTEXITCODE -ne 0) { throw 'The Chatterbox test requires Python 3.10 through 3.13.' }
$nanoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.skelly-build/local-talkback'))
$nanoModel = Join-Path $nanoRoot 'chatterbox-model'
$nanoEnv = Join-Path $nanoRoot 'chatterbox-env'
New-Item -ItemType Directory -Path $nanoModel -Force | Out-Null
$nanoRevision = '71ccd1d0081b430592cea481f4307e764e07bc64'
$nanoFiles = @(
  @{Name='ve.safetensors'; Hash='f0921cab452fa278bc25cd23ffd59d36f816d7dc5181dd1bef9751a7fb61f63c'},
  @{Name='t3_nano_v1.safetensors'; Hash='72b110185087d945dbdf54dee4e333848e1811bdd5fd6cb16ceb8da50006f0c9'},
  @{Name='s3gen_meanflow.safetensors'; Hash='d65cb687a2ed581ee6cc297e919ffefa63386944f42364ae13b78a594945514f'},
  @{Name='conds.pt'; Hash='b1852099306fd6a7814eb9d0bd10186caba7249596cc23868f78a0eefbfa5033'},
  @{Name='tokenizer_config.json'}, @{Name='vocab.json'}, @{Name='merges.txt'},
  @{Name='added_tokens.json'}, @{Name='special_tokens_map.json'}
)
foreach ($nanoFile in $nanoFiles) {
  $nanoPath = Join-Path $nanoModel $nanoFile.Name
  if ((Test-Path -LiteralPath $nanoPath) -and $nanoFile.Hash -and (Get-FileHash -LiteralPath $nanoPath -Algorithm SHA256).Hash -eq $nanoFile.Hash) { continue }
  $nanoUrl = 'https://huggingface.co/ResembleAI/chatterbox-nano/resolve/' + $nanoRevision + '/' + $nanoFile.Name + '?download=true'
  Write-Host ('Downloading ' + $nanoFile.Name)
  & curl.exe --location --fail --silent --show-error --max-time 1200 --output ($nanoPath + '.part') $nanoUrl
  if ($LASTEXITCODE -ne 0) { throw ('Download failed: ' + $nanoFile.Name) }
  if ($nanoFile.Hash -and (Get-FileHash -LiteralPath ($nanoPath + '.part') -Algorithm SHA256).Hash -ne $nanoFile.Hash) { throw ('Digest mismatch: ' + $nanoFile.Name) }
  Move-Item -LiteralPath ($nanoPath + '.part') -Destination $nanoPath -Force
}
$nanoArchive = Join-Path $nanoRoot 'chatterbox-source-5de7a54.zip'
$nanoArchiveHash = 'bb7363a76c0c0432a0305681fe2e533bbfb0f10fcf7b98d75a439d9a909f1576'
if (!(Test-Path -LiteralPath $nanoArchive) -or (Get-FileHash -LiteralPath $nanoArchive -Algorithm SHA256).Hash -ne $nanoArchiveHash) {
  & curl.exe --location --fail --silent --show-error --max-time 180 --output ($nanoArchive + '.part') 'https://github.com/resemble-ai/chatterbox/archive/5de7a54aa4e5e2baadb0182dde554908b48b85c2.zip'
  if ($LASTEXITCODE -ne 0) { throw 'Chatterbox source download failed.' }
  if ((Get-FileHash -LiteralPath ($nanoArchive + '.part') -Algorithm SHA256).Hash -ne $nanoArchiveHash) { throw 'Chatterbox source digest mismatch.' }
  Move-Item -LiteralPath ($nanoArchive + '.part') -Destination $nanoArchive -Force
}
$nanoExtract = Join-Path $PSScriptRoot '../experiments/local-talkback/chatterbox_extract.py'
& $Python $nanoExtract
if ($LASTEXITCODE -ne 0) { throw 'Chatterbox source extraction failed.' }
if (!(Test-Path -LiteralPath (Join-Path $nanoEnv 'Scripts/python.exe'))) {
  & $Python -m venv $nanoEnv
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated Python environment.' }
}
$nanoPython = Join-Path $nanoEnv 'Scripts/python.exe'
$nanoPreviousPipCheck = [Environment]::GetEnvironmentVariable('PIP_DISABLE_PIP_VERSION_CHECK', 'Process')
try {
  [Environment]::SetEnvironmentVariable('PIP_DISABLE_PIP_VERSION_CHECK', '1', 'Process')
  & $nanoPython -m pip install --no-cache-dir --index-url 'https://download.pytorch.org/whl/cpu' 'torch==2.6.0' 'torchaudio==2.6.0'
  if ($LASTEXITCODE -ne 0) { throw 'CPU runtime installation failed.' }
  & $nanoPython -m pip install --no-cache-dir 'chatterbox-tts==0.1.7'
  if ($LASTEXITCODE -ne 0) { throw 'Chatterbox dependency installation failed.' }
} finally {
  [Environment]::SetEnvironmentVariable('PIP_DISABLE_PIP_VERSION_CHECK', $nanoPreviousPipCheck, 'Process')
}
Write-Host 'Local Chatterbox Nano test files are ready. No model or speaker was started.'
