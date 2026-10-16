"""Publish the reviewed source and a bounded Pages tree without changing files.

The source commit preserves all authoring assets. Only the deployment index
omits offline development files and OBJ source copies; GLBs, blueprints and
all application/audio assets stay available. No checkout, reset or deletion.
"""
from pathlib import Path
import argparse
import json
import os
import subprocess

ROOT=Path(__file__).resolve().parent.parent


def git(*args,input=None,env=None):
    return subprocess.check_output(['git',*args],cwd=ROOT,input=input,env=env).decode().strip()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--push',action='store_true');args=parser.parse_args()
    source=git('rev-parse','HEAD');branch=git('branch','--show-current')
    status=git('status','--porcelain','--untracked-files=all')
    if status:raise RuntimeError('Commit the intended source before packaging; worktree must be clean')
    previous=git('ls-remote','origin','refs/heads/gh-pages').split()[0]
    subprocess.run(['git','fetch','origin','gh-pages'],cwd=ROOT,check=True)
    folder=ROOT/'output/band-hybrid-release';folder.mkdir(parents=True,exist_ok=True)
    env=dict(os.environ);env['GIT_INDEX_FILE']=str(folder/f'pages-index-{source[:12]}')
    git('read-tree',source,env=env)
    entries=[]
    for line in git('ls-tree','-r','-l',source).splitlines():
        info,path=line.split('\t',1);size=int(info.split()[-1]);entries.append((path,size))
    excluded=[p for p,_ in entries if p.startswith(('scripts/','test/','tests/','05_Project_Management/')) or ('/hunyuan3d/' in p and '/obj/' in p)]
    if excluded:git('update-index','--force-remove','--',*excluded,env=env)
    size=sum(n for p,n in entries if p not in set(excluded))
    if size>=1024**3:raise RuntimeError(f'Pages bundle exceeds 1 GiB: {size}')
    tree=git('write-tree',env=env)
    message=f'Deploy complete original-first band playback\n\nSource: {source}\nAuthoring originals remain in {branch}; runtime tree {size} bytes.\n'
    deployed=git('commit-tree',tree,'-p',previous,input=message.encode())
    result={'sourceCommit':source,'sourceBranch':branch,'pagesCommit':deployed,'previousPagesCommit':previous,
            'runtimeBytes':size,'excludedSourceFiles':excluded,'localFilesRemoved':False,'pushed':False}
    (folder/'publication.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    if args.push:
        if git('rev-parse','HEAD')!=source or git('status','--porcelain','--untracked-files=all')!=status:raise RuntimeError('Source changed during release')
        subprocess.run(['git','push','origin',f'{source}:refs/heads/{branch}'],cwd=ROOT,check=True)
        if git('ls-remote','origin','refs/heads/gh-pages').split()[0]!=previous:raise RuntimeError('Pages changed during release; refusing to overwrite')
        subprocess.run(['git','push','origin',f'{deployed}:refs/heads/gh-pages'],cwd=ROOT,check=True)
        result['pushed']=True;(folder/'publication.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k!='excludedSourceFiles'},ensure_ascii=False))


if __name__=='__main__':main()
