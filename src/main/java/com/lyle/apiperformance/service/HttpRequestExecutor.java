package com.lyle.apiperformance.service;

import org.springframework.stereotype.Component;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.core5.util.Timeout;

import java.io.IOException;

/** Exact authorization and pinned DNS are applied at the transport boundary too. */
@Component
public class HttpRequestExecutor implements AutoCloseable {
    private final TargetValidator validator;
    private final CloseableHttpClient client;

    public HttpRequestExecutor(TargetValidator validator) {
        this.validator = validator;
        var connections = PoolingHttpClientConnectionManagerBuilder.create()
                .setDnsResolver(new PinnedDnsResolver())
                .setMaxConnTotal(100).setMaxConnPerRoute(100)
                .setDefaultConnectionConfig(ConnectionConfig.custom()
                        .setConnectTimeout(Timeout.ofSeconds(10)).build())
                .build();
        client = HttpClients.custom().setConnectionManager(connections)
                .disableRedirectHandling().disableAutomaticRetries().disableCookieManagement()
                .setDefaultRequestConfig(RequestConfig.custom()
                        .setConnectionRequestTimeout(Timeout.ofSeconds(10))
                        .setResponseTimeout(Timeout.ofSeconds(10)).build())
                .build();
    }

    public int execute(String url) throws IOException, InterruptedException {
        return client.execute(new HttpGet(validator.validate(url)), response -> response.getCode());
    }

    @Override
    public void close() {
        try {
            client.close();
        } catch (IOException exception) {
            throw new java.io.UncheckedIOException(exception);
        }
    }
}
