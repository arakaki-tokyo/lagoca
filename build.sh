#!/bin/bash

PRJROOT=$(pwd)
HTML=${PRJROOT}/dist/index.html
JS=${PRJROOT}/dist/index.js
QUILL=${PRJROOT}/node_modules/quill/dist/quill.min.js
SORTABLEJS=${PRJROOT}/node_modules/sortablejs/Sortable.min.js

mv ${JS} src/
cat ${QUILL} ${SORTABLEJS} src/index.js | sed '/sourceMap/d' > ${JS}

purgecss --css node_modules/bulma/css/bulma.min.css \
    --content ${JS} ${HTML} \
    --output src/

sleep 5
webpack
rm dist/bundle_css.js

ls -1 | grep -E -v "dist|CNAME" | xargs rm -rf
mv dist/* ./
rm -rf dist/