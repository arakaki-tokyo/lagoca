#!/bin/bash

PRJROOT=$(pwd)
JSFILE=${PRJROOT}/dist/index.js

cp ${JSFILE} src/
cat node_modules/quill/dist/quill.min.js src/index.js > ${JSFILE}
rm src/index.js

webpack
rm dist/bundle_css.js