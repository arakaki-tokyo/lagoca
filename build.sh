#!/bin/bash

PRJROOT=$(pwd)
JSFILE=${PRJROOT}/dist/index.js

cp ${JSFILE} src/
cat node_modules/quill/dist/quill.min.js src/index.js > ${JSFILE}
rm src/index.js

webpack
rm dist/bundle_css.js

ls -1 | grep -E -v "dist|CNAME" | xargs rm -rf
mv dist/* ./
rm -rf dist/