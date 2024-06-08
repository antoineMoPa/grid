#!/bin/bash

set -e

yarn run build

git switch dist
rm -rf docs
mv dist docs
git add docs
git commit -m "Deploy"
git push origin dist --force-with-lease
git switch main
