package com.lyle.apiperformance.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.List;
import java.util.Locale;

/** Exact URL authorization; configuration is trusted operator input. */
@Component
public class TargetValidator {
    private final List<String> targets;

    public TargetValidator(@Value("${pulse.approved-targets}") List<String> targets) {
        this.targets = targets.stream().map(TargetValidator::normalize).distinct().toList();
        if (this.targets.isEmpty()) throw new IllegalArgumentException("Configure at least one approved target");
    }

    public List<String> approvedTargets() {
        return targets;
    }

    public String validate(String url) {
        String normalized = normalize(url);
        if (!targets.contains(normalized)) {
            throw new IllegalArgumentException("Only an explicitly approved target URL is allowed");
        }
        return normalized;
    }

    static String normalize(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if ((!scheme.equals("http") && !scheme.equals("https")) || uri.getHost() == null
                    || uri.getRawAuthority().endsWith(":") || uri.getRawUserInfo() != null || uri.getRawFragment() != null
                    || uri.getPort() < -1 || uri.getPort() == 0 || uri.getPort() > 65535) {
                throw new IllegalArgumentException();
            }
            int port = uri.getPort();
            if (port == (scheme.equals("https") ? 443 : 80)) port = -1;
            String path = uri.normalize().getRawPath();
            if (path == null || path.isEmpty()) path = "/";
            return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT)
                    + (port == -1 ? "" : ":" + port) + path
                    + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
        } catch (Exception exception) {
            throw new IllegalArgumentException("Target must be a valid HTTP(S) URL without credentials or fragments");
        }
    }
}
