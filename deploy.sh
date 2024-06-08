#!/bin/bash

set -e

git switch dist
rm -rf docs
yarn run build
mv dist docs
git add docs
git commit -m "Deploy"
git push origin dist
git switch main
