<#
  SwasthSetu - vaccination module smoke test (Steps 2-5), run against your LOCAL server.

  Needs: backend running (npm run dev), Postgres up, vaccines seeded, and these accounts:
    - a HELPER that has a helper profile and is linked to exactly one facility
    - an ADMIN (npm run seed:admin)
  Run from the project folder:
    .\scripts\vaccination-smoke.ps1 -HelperEmail h@x.com -HelperPassword "..." -AdminEmail a@x.com -AdminPassword "..."

  For repeatable reminder checks, set REMINDER_SCHEDULER_ENABLED=false in .env and restart the
  server first (otherwise the background timer may send some reminders before this script does).

  It creates ONE test child named "Smoke Test <random>" in your database (delete it in
  Prisma Studio afterwards if you like). It changes nothing else.
#>
param(
  [Parameter(Mandatory)] [string] $HelperEmail,
  [Parameter(Mandatory)] [string] $HelperPassword,
  [Parameter(Mandatory)] [string] $AdminEmail,
  [Parameter(Mandatory)] [string] $AdminPassword,
  [string] $Base = "http://localhost:5000/api/v1"
)

$script:pass = 0
$script:fail = 0
function Check([string]$name, [bool]$ok, [string]$detail = "") {
  if ($ok) { $script:pass++; Write-Host "PASS  $name" -ForegroundColor Green }
  else { $script:fail++; Write-Host "FAIL  $name  $detail" -ForegroundColor Red }
}

# Returns @{ Status = <http code>; Body = <parsed json or $null> } and never throws
function Call([string]$Method, [string]$Path, $Token = $null, $Body = $null) {
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $req = @{ Uri = "$Base$Path"; Method = $Method; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $Body) { $req["ContentType"] = "application/json"; $req["Body"] = ($Body | ConvertTo-Json -Depth 6) }
  try {
    $r = Invoke-WebRequest @req
    return @{ Status = [int]$r.StatusCode; Body = ($r.Content | ConvertFrom-Json) }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    $parsed = $null
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { try { $parsed = $_.ErrorDetails.Message | ConvertFrom-Json } catch {} }
    return @{ Status = $code; Body = $parsed }
  }
}

function Login([string]$email, [string]$password) {
  $r = Call "POST" "/auth/login" $null @{ email = $email; password = $password }
  if ($r.Status -ne 200) { throw "Login failed for $email (HTTP $($r.Status))" }
  $d = $r.Body.data
  foreach ($t in @($d.accessToken, $d.tokens.accessToken, $r.Body.accessToken)) { if ($t) { return $t } }
  throw "Could not find the access token in the login response. Edit the Login function."
}

$helper = Login $HelperEmail $HelperPassword
$admin = Login $AdminEmail $AdminPassword
Write-Host "Logged in as helper and admin`n"

# ---- register a child due for its 6-week vaccines TOMORROW ----
$today = (Get-Date).Date
$dob = $today.AddDays(-41).ToString("yyyy-MM-dd")
$tomorrow = $today.AddDays(1).ToString("yyyy-MM-dd")
$rand = Get-Random -Minimum 1000 -Maximum 9999
$mobile = "98" + (Get-Random -Minimum 10000000 -Maximum 99999999)
$child = @{
  fullName = "Smoke Test $rand"; dateOfBirth = $dob; gender = "FEMALE"
  motherName = "Test Mother"; fatherName = "Test Father"; primaryMobile = $mobile
  addressLine = "Ward 1"; village = "Testpur"; district = "Testdist"; state = "Uttar Pradesh"; pinCode = "226001"
  smsConsent = $true; preferredLanguage = "HI"
}

$r = Call "POST" "/children" $helper $child
Check "register child -> 201" ($r.Status -eq 201) "got $($r.Status)"
if ($r.Status -ne 201) { Write-Host ($r.Body | ConvertTo-Json -Depth 5); exit 1 }
$childId = $r.Body.data.id

# ---- dashboard ----
$r = Call "GET" "/children/$childId/dashboard" $helper
Check "dashboard -> 200" ($r.Status -eq 200)
$dash = $r.Body.data
Check "next visit is tomorrow" ($dash.nextVisit.date -eq $tomorrow) "got $($dash.nextVisit.date)"
Check "five 6-week vaccines are due at the next visit" ($dash.nextVisit.doses.Count -eq 5) "got $($dash.nextVisit.doses.Count)"
Check "birth doses are overdue" ($dash.summary.overdue -eq 3) "got $($dash.summary.overdue)"
Check "age is shown in words" ($dash.child.age -like "*month*") "got '$($dash.child.age)'"

# ---- record doses ----
$opv = $dash.nextVisit.doses | Where-Object { $_.vaccineCode -eq "OPV" } | Select-Object -First 1
$penta = $dash.nextVisit.doses | Where-Object { $_.vaccineCode -eq "PENTA" } | Select-Object -First 1
$r = Call "PATCH" "/children/$childId/doses/$($opv.id)" $helper @{ action = "ADMINISTERED"; batchNumber = "SMOKE-001" }
Check "administer OPV-1 -> 200" ($r.Status -eq 200 -and $r.Body.data.status -eq "ADMINISTERED") "got $($r.Status)"
Check "batch number kept in the note" ($r.Body.data.notes -like "*SMOKE-001*")
$r = Call "PATCH" "/children/$childId/doses/$($opv.id)" $helper @{ action = "ADMINISTERED" }
Check "administering again -> 409" ($r.Status -eq 409) "got $($r.Status)"
$r = Call "PATCH" "/children/$childId/doses/$($penta.id)" $helper @{ action = "POSTPONED"; newDueDate = $today.AddDays(7).ToString("yyyy-MM-dd") }
Check "postpone without a reason -> 400" ($r.Status -eq 400) "got $($r.Status)"
$r = Call "PATCH" "/children/$childId/doses/$($penta.id)" $helper @{ action = "POSTPONED"; newDueDate = $today.AddDays(7).ToString("yyyy-MM-dd"); note = "child has fever" }
Check "postpone with a reason -> 200" ($r.Status -eq 200 -and $r.Body.data.status -eq "POSTPONED") "got $($r.Status)"
$r = Call "PATCH" "/children/$childId/doses/$($opv.id)" $helper @{ action = "PENDING" }
Check "reopen without a note -> 400" ($r.Status -eq 400) "got $($r.Status)"

# ---- reminders: pretend it is today 09:30 IST, after the dose changes above ----
$todayIst = [DateTime]::UtcNow.AddHours(5.5).Date
$asOf = $todayIst.ToString("yyyy-MM-dd") + "T04:00:00Z"
$r = Call "POST" "/vaccination/admin/reminders/run" $admin @{ asOf = $asOf }
Check "admin can run the reminder engine -> 200" ($r.Status -eq 200) "got $($r.Status)"
$r = Call "GET" "/children/$childId/reminders" $helper
Check "reminders listed -> 200" ($r.Status -eq 200)
$rem = @($r.Body.data | Where-Object { $_.dueDate -eq $tomorrow })
$sent = @($rem | Where-Object { $_.status -eq "SENT" })
Check "the 3 doses still open got their 1-day-before reminder" ($sent.Count -eq 3) "sent=$($sent.Count) of $($rem.Count)"
Check "no reminder exists for the given or postponed doses" (@($rem | Where-Object { $_.vaccineName -like "Oral Polio*" -or $_.vaccineName -like "Pentavalent*" }).Count -eq 0)
$sms = @($sent | ForEach-Object { $_.deliveries } | Where-Object { $_.channel -eq "SMS" -and $_.status -eq "SENT" })
Check "one SMS delivery row per reminder, number masked" ($sms.Count -eq 3 -and $sms[0].recipient -match '^\*{6}\d{4}$') "rows=$($sms.Count)"

$r = Call "GET" "/vaccination/notifications?unread=true" $helper
Check "helper has an in-app notification" ($r.Status -eq 200 -and $r.Body.data.unread -ge 1)
$note = $r.Body.data.items | Where-Object { $_.child.id -eq $childId } | Select-Object -First 1
Check "notification title says due tomorrow" ($note.title -eq "Vaccination due tomorrow") "got '$($note.title)'"
Check "one combined notification lists all three vaccines" (($note.body -like "*Rotavirus*") -and ($note.body -like "*Fractional*") -and ($note.body -like "*Pneumococcal*")) "got '$($note.body)'"

# ---- dashboard + history after changes ----
$r = Call "GET" "/children/$childId/dashboard" $helper
Check "dashboard counts 1 administered" ($r.Body.data.summary.administered -eq 1) "got $($r.Body.data.summary.administered)"
$r = Call "GET" "/children/$childId/history" $helper
Check "history has the audit rows" ($r.Status -eq 200 -and $r.Body.data.total -ge 2) "total=$($r.Body.data.total)"

# ---- worklist, stats, centres ----
$r = Call "GET" "/vaccination/worklist?status=OVERDUE" $helper
Check "worklist -> 200 and lists overdue doses" ($r.Status -eq 200 -and $r.Body.data.summary.overdue -ge 3)
$r = Call "GET" "/vaccination/stats" $helper
Check "helper stats -> 200" ($r.Status -eq 200 -and $r.Body.data.children -ge 1)
$r = Call "GET" "/vaccination/centres" $helper
Check "centre search -> 200" ($r.Status -eq 200)
$r = Call "GET" "/children/$childId/centres" $helper
Check "centres for this child -> 200" ($r.Status -eq 200 -and $r.Body.data.vaccineCodes.Count -ge 1)

# ---- access control ----
$r = Call "GET" "/children" $admin
Check "admin cannot list children -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Call "GET" "/children/$childId" $admin
Check "admin cannot open a child -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Call "GET" "/vaccination/admin/stats" $admin
Check "admin stats -> 200" ($r.Status -eq 200 -and $r.Body.data.children.total -ge 1)
$r = Call "GET" "/vaccination/admin/stats" $helper
Check "helper cannot read admin stats -> 403" ($r.Status -eq 403) "got $($r.Status)"
$r = Call "POST" "/vaccination/admin/reminders/run" $helper @{}
Check "helper cannot run the reminder engine -> 403" ($r.Status -eq 403) "got $($r.Status)"

# ---- admin schedule management (validation only: nothing is created) ----
$r = Call "GET" "/vaccination/admin/vaccines" $admin
Check "admin vaccine list -> 200" ($r.Status -eq 200 -and @($r.Body.data).Count -ge 11)
$bcgId = (@($r.Body.data) | Where-Object { $_.code -eq "BCG" }).id
$r = Call "POST" "/vaccination/admin/vaccines/$bcgId/entries" $admin @{ doseNumber = 9; doseLabel = "Test"; ageValue = 19; ageUnit = "YEARS"; ageLabel = "19 years" }
Check "dose due after age 18 -> 400" ($r.Status -eq 400) "got $($r.Status)"
$r = Call "POST" "/vaccination/admin/vaccines/$bcgId/entries" $admin @{ doseNumber = 1; doseLabel = "Dup"; ageValue = 1; ageUnit = "DAYS"; ageLabel = "1 day" }
Check "duplicate dose number -> 409" ($r.Status -eq 409) "got $($r.Status)"
$r = Call "GET" "/vaccination/schedule" $helper
Check "any signed-in user can read the schedule -> 200" ($r.Status -eq 200)

Write-Host "`n$($script:pass) passed, $($script:fail) failed"
exit ($(if ($script:fail -gt 0) { 1 } else { 0 }))
