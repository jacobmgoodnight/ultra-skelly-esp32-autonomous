# Optional Windows CPU-only engines. No global installation or startup tasks.
$ErrorActionPreference = 'Stop'
$talkbackRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$talkbackTools = Join-Path $talkbackRoot '.skelly-build/local-talkback'
New-Item -ItemType Directory -Path $talkbackTools -Force | Out-Null
$talkbackFiles = @(
    @{ Name='llama.zip'; Folder='llama'; Url='https://github.com/ggml-org/llama.cpp/releases/download/b11901/llama-b11901-bin-win-cpu-x64.zip'; Hash='039951745399d7c1228b1e882d6e41b24d393f1795e3a6e176162bfb8193500a' },
    @{ Name='whisper.zip'; Folder='whisper'; Url='https://github.com/ggml-org/whisper.cpp/releases/download/b5454/whisper-bin-x64.zip'; Hash='6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb' },
    @{ Name='qwen2.5-0.5b-instruct-q4_k_m.gguf'; Url='https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true'; Hash='74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db' },
    @{ Name='ggml-tiny.en.bin'; Url='https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin?download=true'; Hash='921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f' }
)
foreach ($talkbackFile in $talkbackFiles) {
    $talkbackTarget = Join-Path $talkbackTools $talkbackFile.Name
    if (!(Test-Path -LiteralPath $talkbackTarget) -or (Get-FileHash -LiteralPath $talkbackTarget -Algorithm SHA256).Hash -ne $talkbackFile.Hash) {
        Write-Host ('Downloading ' + $talkbackFile.Name)
        $talkbackPartial = $talkbackTarget + '.part'
        # curl streams large models without PowerShell's progress/response buffering.
        & curl.exe --location --fail --silent --show-error --max-time 600 --output $talkbackPartial $talkbackFile.Url
        if ($LASTEXITCODE -ne 0) { throw ('Download failed: ' + $talkbackFile.Name) }
        if ((Get-FileHash -LiteralPath $talkbackPartial -Algorithm SHA256).Hash -ne $talkbackFile.Hash) { throw ('Hash mismatch: ' + $talkbackFile.Name) }
        Move-Item -LiteralPath $talkbackPartial -Destination $talkbackTarget -Force
    }
    if ($talkbackFile.Folder) { Expand-Archive -LiteralPath $talkbackTarget -DestinationPath (Join-Path $talkbackTools $talkbackFile.Folder) -Force }
}
Write-Host 'Verified local engines are ready. Nothing was started. See docs/local-halloween-conversation.md.'
