#!/bin/sh
GITLABREPO="registry.gitlab.com"
GITLABUSER="arizawan"
GITLABREGPASS="Fd-u1XDBtGrVD36KPfs3"
REPOIMG="registry.gitlab.com/mhubt/ex-xrpl"
REPOIMGTAG="dev"

echo $GITLABREGPASS | docker login $GITLABREPO --username $GITLABUSER --password-stdin
docker build -t $REPOIMG .
docker tag $REPOIMG:latest $REPOIMG:$REPOIMGTAG
docker push $REPOIMG:$REPOIMGTAG