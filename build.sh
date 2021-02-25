#!/bin/bash

PRJROOT=$(pwd)
HTML=${PRJROOT}/dist/index.html
JSFILE=${PRJROOT}/dist/index.js

cp ${JSFILE} src/
cat node_modules/quill/dist/quill.min.js src/index.js > ${JSFILE}
rm src/index.js

purgecss --css node_modules/bulma/css/bulma.min.css \
    --content ${JSFILE} ${HTML} \
    --output src/

sleep 5
webpack
rm dist/bundle_css.js

ls -1 | grep -E -v "dist|CNAME" | xargs rm -rf
mv dist/* ./
rm -rf dist/