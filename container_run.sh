#!/bin/bash

if [ ! $1 ]; then
	NAME=a1
else
	NAME=$1
fi

docker run -dit --name $NAME \
	--restart=always \
	-v $PWD/src:/usr/share/nginx/html \
	nginx:stable-alpine
