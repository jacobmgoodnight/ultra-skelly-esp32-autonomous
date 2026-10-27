param(
    [string] $Python = 'python',
    [string] $VoiceId = ''
)
$ErrorActionPreference = 'Stop'
if ($VoiceId -and $VoiceId -notmatch '^[A-Za-z0-9]{10,50}$') {
    throw 'The voice ID must contain 10 to 50 letters or numbers.'
}
$voiceOldKey = [Environment]::GetEnvironmentVariable('SKELLY_ELEVENLABS_API_KEY', 'Process')
$voiceOldId = [Environment]::GetEnvironmentVariable('SKELLY_ELEVENLABS_VOICE_ID', 'Process')
$voiceSecureKey = Read-Host 'ElevenLabs API key (input hidden)' -AsSecureString
$voicePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($voiceSecureKey)
try {
    $voicePlainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($voicePointer)
    if (!$voicePlainKey) { throw 'No API key was entered.' }
    if ($voicePlainKey.Length -gt 512 -or $voicePlainKey -cnotmatch '^[\x21-\x7E]+$') {
        throw 'The API key contains whitespace or unsupported characters. Copy only the key and try again; do not share it in chat.'
    }
    [Environment]::SetEnvironmentVariable('SKELLY_ELEVENLABS_API_KEY', $voicePlainKey, 'Process')
    if ($VoiceId) { [Environment]::SetEnvironmentVariable('SKELLY_ELEVENLABS_VOICE_ID', $VoiceId, 'Process') }
    else { [Environment]::SetEnvironmentVariable('SKELLY_ELEVENLABS_VOICE_ID', $null, 'Process') }
    $voiceCompanion = Join-Path $PSScriptRoot '../experiments/local-talkback/companion.py'
    & $Python $voiceCompanion
    if ($LASTEXITCODE -ne 0) { throw 'The local companion could not start.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($voicePointer)
    [Environment]::SetEnvironmentVariable('SKELLY_ELEVENLABS_API_KEY', $voiceOldKey, 'Process')
    [Environment]::SetEnvironmentVariable('SKELLY_ELEVENLABS_VOICE_ID', $voiceOldId, 'Process')
    Remove-Variable voicePlainKey -ErrorAction SilentlyContinue
    $voiceSecureKey.Dispose()
}
