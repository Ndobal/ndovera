$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$superSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$schoolAdminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$studentSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$outputPath = '.\scripts\verify-hosted-exam-flow.output.json'
$stage = 'initialize'

try {
  $stage = 'super-login'
  $superLoginBody = @{ email = 'super@ndovera.test'; password = 'Super123!' } | ConvertTo-Json
  Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/super/auth/login' -Method Post -WebSession $superSession -ContentType 'application/json' -Body $superLoginBody | Out-Null
  $stage = 'super-csrf'
  $superCsrf = (Invoke-RestMethod -Uri 'http://127.0.0.1:3001/csrf-token' -Method Get -WebSession $superSession).csrfToken

$examBody = @{
  title = "Ndovera Hosted Exam $timestamp"
  description = 'Hosted by Ndovera for every school in the system.'
  type = 'exam'
  scope = 'hosted'
  mode = 'single'
  status = 'active'
  hostOrganization = 'African Schools Consortium'
  hostedByNdovera = $true
  entryFee = 0
  questions = @(
    @{
      type = 'multiple-choice'
      prompt = 'What is 12 multiplied by 8?'
      options = @('84', '96', '108', '112')
      correctAnswer = '96'
      explanation = '12 x 8 = 96'
      points = 5
    },
    @{
      type = 'multiple-choice'
      prompt = 'Which planet is known as the Red Planet?'
      options = @('Venus', 'Mars', 'Jupiter', 'Mercury')
      correctAnswer = 'Mars'
      explanation = 'Mars is commonly called the Red Planet.'
      points = 5
    }
  )
} | ConvertTo-Json -Depth 6
  $stage = 'super-create-exam'
  $exam = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/super/championships' -Method Post -WebSession $superSession -Headers @{ 'x-csrf-token' = $superCsrf } -ContentType 'application/json' -Body $examBody

  $stage = 'school-admin-login'
  $schoolLoginBody = @{ identifier = 'admin@ndovera.test'; password = 'Admin123!' } | ConvertTo-Json
  Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/auth/login' -Method Post -WebSession $schoolAdminSession -ContentType 'application/json' -Body $schoolLoginBody | Out-Null
  $stage = 'school-admin-csrf'
  $schoolCsrf = (Invoke-RestMethod -Uri 'http://127.0.0.1:3000/csrf-token' -Method Get -WebSession $schoolAdminSession).csrfToken

$studentPassword = 'Student123!'
$studentBody = @{
  category = 'student'
  schoolId = 'school-1'
  schoolName = 'Ndovera Academy'
  name = "Hosted Exam Student $timestamp"
  email = "student.$timestamp@ndovera.test"
  password = $studentPassword
  roles = @('Student')
} | ConvertTo-Json -Depth 5
  $stage = 'student-provision'
  $studentProvision = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/users/provision' -Method Post -WebSession $schoolAdminSession -Headers @{ 'x-csrf-token' = $schoolCsrf } -ContentType 'application/json' -Body $studentBody
  $studentIdentifier = $studentProvision.user.id

  $stage = 'student-login'
  $studentLoginBody = @{ identifier = $studentIdentifier; password = $studentPassword } | ConvertTo-Json
  Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/auth/login' -Method Post -WebSession $studentSession -ContentType 'application/json' -Body $studentLoginBody | Out-Null
  $stage = 'student-csrf'
  $studentCsrf = (Invoke-RestMethod -Uri 'http://127.0.0.1:3000/csrf-token' -Method Get -WebSession $studentSession).csrfToken

  $stage = 'student-portal'
  $portal = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/championships/portal' -Method Get -WebSession $studentSession
  $stage = 'student-join'
  $joinUri = "http://127.0.0.1:3000/api/championships/$($exam.competition.id)/join"
  $joined = Invoke-RestMethod -Uri $joinUri -Method Post -WebSession $studentSession -Headers @{ 'x-csrf-token' = $studentCsrf } -ContentType 'application/json' -Body '{}'
  $stage = 'student-detail'
  $detailUri = "http://127.0.0.1:3000/api/championships/$($exam.competition.id)"
  $detail = Invoke-RestMethod -Uri $detailUri -Method Get -WebSession $studentSession
  $firstQuestion = $detail.questions[0]
  $stage = 'student-answer'
  $answerBody = @{ questionId = $firstQuestion.id; answer = '96'; timeTaken = 12000 } | ConvertTo-Json
  $answer = Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/championships/$($exam.competition.id)/answers" -Method Post -WebSession $studentSession -Headers @{ 'x-csrf-token' = $studentCsrf } -ContentType 'application/json' -Body $answerBody

$summary = [pscustomobject]@{
  examId = $exam.competition.id
  examTitle = $exam.competition.title
  studentId = $studentIdentifier
  portalCount = $portal.competitions.Count
  joinedStatus = $joined.participant.status
  scoreAfterFirstAnswer = $answer.participant.score
  leaderboardTopUser = if ($answer.leaderboard.Count -gt 0) { $answer.leaderboard[0].userId } else { $null }
}

  $summaryJson = $summary | ConvertTo-Json -Compress
  Set-Content -Path $outputPath -Value $summaryJson
  Write-Output $summaryJson
} catch {
  $errorSummary = [pscustomobject]@{
    stage = $stage
    error = $_.Exception.Message
  } | ConvertTo-Json -Compress
  Set-Content -Path $outputPath -Value $errorSummary
  Write-Error $errorSummary
  throw
}
