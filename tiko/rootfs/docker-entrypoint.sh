#!/usr/bin/env bashio

if ! bashio::config.exists 'MQTT_BROKER_URL'; then
    bashio::log.info "MQTT_BROKER_URL not set, using MQTT addon service..."

    if ! bashio::services.available "mqtt"; then
        bashio::exit.nok "MQTT_BROKER_URL is not set and no MQTT addon service is configured"
    fi

    if bashio::var.true "$(bashio::services 'mqtt' 'ssl')"; then
        export MQTT_BROKER_URL
        MQTT_BROKER_URL="mqtts://$(bashio::services 'mqtt' 'host'):$(bashio::services 'mqtt' 'port')"
    else
        export MQTT_BROKER_URL
        MQTT_BROKER_URL="mqtt://$(bashio::services 'mqtt' 'host'):$(bashio::services 'mqtt' 'port')"
    fi

    export MQTT_USERNAME
    MQTT_USERNAME="$(bashio::services 'mqtt' 'username')"
    export MQTT_PASSWORD
    MQTT_PASSWORD="$(bashio::services 'mqtt' 'password')"
fi

exec node dist/index.js
