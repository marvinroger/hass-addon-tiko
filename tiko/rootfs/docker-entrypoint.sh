#!/usr/bin/env bashio

if bashio::supervisor.ping; then
    bashio::log.info "Running in Home Assistant mode"

    export TIKO_PROVIDER
    TIKO_PROVIDER=$(bashio::config 'TIKO_PROVIDER')
    export TIKO_EMAIL
    TIKO_EMAIL=$(bashio::config 'TIKO_EMAIL')
    export TIKO_PASSWORD
    TIKO_PASSWORD=$(bashio::config 'TIKO_PASSWORD')
    export TIKO_PROPERTY_ID
    TIKO_PROPERTY_ID=$(bashio::config 'TIKO_PROPERTY_ID')
    export MQTT_BROKER_URL
    MQTT_BROKER_URL=$(bashio::config 'MQTT_BROKER_URL')
    export MQTT_USERNAME
    MQTT_USERNAME=$(bashio::config 'MQTT_USERNAME')
    export MQTT_PASSWORD
    MQTT_PASSWORD=$(bashio::config 'MQTT_PASSWORD')
    export UPDATE_INTERVAL_MINUTES
    UPDATE_INTERVAL_MINUTES=$(bashio::config 'UPDATE_INTERVAL_MINUTES')

    if bashio::config.is_empty 'MQTT_BROKER_URL'; then
        bashio::log.info "MQTT_BROKER_URL not set, using MQTT addon service..."

        if ! bashio::services.available "mqtt"; then
            bashio::exit.nok "MQTT_BROKER_URL is not set and no MQTT addon service is configured"
        fi

        if bashio::var.true "$(bashio::services 'mqtt' 'ssl')"; then
            MQTT_BROKER_URL="mqtts://$(bashio::services 'mqtt' 'host'):$(bashio::services 'mqtt' 'port')"
        else
            MQTT_BROKER_URL="mqtt://$(bashio::services 'mqtt' 'host'):$(bashio::services 'mqtt' 'port')"
        fi

        MQTT_USERNAME="$(bashio::services 'mqtt' 'username')"
        MQTT_PASSWORD="$(bashio::services 'mqtt' 'password')"
    fi

    
else
    bashio::log.info "Running in standalone mode"
fi

exec node dist/index.js
