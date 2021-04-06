#!/bin/bash

PRJROOT=$(pwd)
DIST=${PRJROOT}/docs
TMPDIR=${PRJROOT}/tmp
HTML=index.html
JS=index.js
BUNDLE_CSS_JS=${DIST}/bundle_css.js
QUILL=${PRJROOT}/node_modules/quill/dist/quill.min.js
SORTABLEJS=${PRJROOT}/node_modules/sortablejs/Sortable.min.js

# bundle js files
mkdir ${TMPDIR}
mv ${DIST}/${JS} ${TMPDIR}
cat ${QUILL} ${SORTABLEJS} ${TMPDIR}/${JS} | sed '/sourceMap/d' > ${DIST}/${JS}

# conduct purgecss on bulma css
purgecss --css node_modules/bulma/css/bulma.min.css \
    --content ${DIST}/${JS} ${DIST}/${HTML} \
    --output ${TMPDIR}

sleep 5

# bundle css files
cat << EOS > ${BUNDLE_CSS_JS}
import '${TMPDIR}/bulma.min.css';
import '../node_modules/quill/dist/quill.snow.css';
import './style.css';
EOS

webpack
rm ${BUNDLE_CSS_JS}
rm -rf ${TMPDIR}