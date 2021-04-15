#!/bin/bash
TIMEFORMAT="in %U s"
PRJROOT=$(pwd)
SRC=${PRJROOT}/src
DIST=${PRJROOT}/docs
HTML=index.html
JS=index.js
BUNDLE_CSS_JS=${SRC}/bundle_css.js
BUNDLE_CSS_JS_OUT=${DIST}/bundle_css.js
QUILL=${PRJROOT}/node_modules/quill/dist/quill.min.js
SORTABLEJS=${PRJROOT}/node_modules/sortablejs/Sortable.min.js

if [ -d ${DIST} ]; then
    rm -rf ${DIST}
fi

cp -r ${SRC} ${DIST}
# tranpile index.js
printf "babel processing ..."
time npx babel ${DIST}/${JS} --out-file ${SRC}/${JS}

# bundle js files
cat ${QUILL} ${SORTABLEJS} ${SRC}/${JS} | sed '/sourceMap/d' > ${DIST}/${JS}

# conduct purgecss on bulma css
printf "purgecss processing ..."
time npx purgecss --css node_modules/bulma/css/bulma.min.css \
    --content ${DIST}/${JS} ${DIST}/${HTML} \
    --output ${SRC}

# bundle css files
echo "webpack processing ..."
cat << EOS > ${BUNDLE_CSS_JS}
import '${SRC}/bulma.min.css';
import '../node_modules/quill/dist/quill.snow.css';
import '${SRC}/style.css';
EOS

npx webpack
rm ${BUNDLE_CSS_JS} ${BUNDLE_CSS_JS_OUT} ${SRC}/bulma.min.css