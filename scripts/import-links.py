"""Import Fudan origins only; never copy the raw browser history database."""
import json,os,sqlite3,subprocess
from pathlib import Path,PureWindowsPath
from urllib.parse import urlsplit,quote

def local_app_data():
    value=os.environ.get('LOCALAPPDATA')
    if not value:
        value=subprocess.check_output(['/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoLogo','-NoProfile','-NonInteractive','-Command','[Environment]::GetFolderPath("LocalApplicationData")'],text=True,timeout=10).strip()
    if value.startswith('/'):
        return Path(value)
    path=PureWindowsPath(value)
    return Path('/mnt')/path.drive[0].lower()/Path(*path.parts[1:])

def collect():
    root=local_app_data();origins=set();profiles=0
    for browser in ['Microsoft/Edge/User Data','Google/Chrome/User Data']:
        directory=root/browser
        if not directory.exists():continue
        for profile in directory.iterdir():
            if profile.name!='Default' and not profile.name.startswith('Profile '):continue
            database=profile/'History'
            if not database.is_file():continue
            try:
                db=sqlite3.connect('file:'+quote(str(database),safe='/')+'?mode=ro&immutable=1',uri=True)
                rows=db.execute("SELECT url FROM urls WHERE lower(url) LIKE '%fudan.edu.cn%' OR lower(url) LIKE '%fdu.edu.cn%'")
                for (value,) in rows:
                    try:
                        url=urlsplit(value);host=(url.hostname or '').lower()
                        if url.scheme in ['https','http'] and not url.username and not url.password and any(host==d or host.endswith('.'+d) for d in ['fudan.edu.cn','fdu.edu.cn']):
                            origins.add(url.scheme+'://'+host+(':'+str(url.port) if url.port else ''))
                    except ValueError:pass
                db.close();profiles+=1
            except (OSError,sqlite3.Error):continue
    if not profiles:raise RuntimeError('No readable browser history profiles')
    directory=Path.home()/'.local/share/fdudash';directory.mkdir(parents=True,exist_ok=True,mode=0o700)
    destination=directory/'links.json';temporary=directory/'links.json.tmp'
    temporary.write_text(json.dumps({'origins':sorted(origins),'source':'Local browser history','profiles':profiles},ensure_ascii=False),encoding='utf8');temporary.chmod(0o600);temporary.replace(destination)
    print(json.dumps({'profiles':profiles,'origins':len(origins)}))

if __name__=='__main__':collect()
