'use strict';

let instance = null;

const log = require('../../net2/logger')(__filename);

const fs = require('fs');
const f = require('../../net2/Firewalla.js');

const Promise = require('bluebird');
Promise.promisifyAll(fs);

const rclient = require('../../util/redis_manager').getRedisClient();

const templatePath = `${f.getFirewallaHome()}/extension/dnscrypt/dnscrypt.template.toml`;
const runtimePath = `${f.getRuntimeInfoFolder()}/dnscrypt.toml`;

const exec = require('child-process-promise').exec;

const serverKey = "ext.dnscrypt.servers";
const allServerKey = "ext.dnscrypt.allServers";

const bone = require("../../lib/Bone");

class DNSCrypt {
  constructor() {
    if(instance === null) {
      instance = this;
      this.config = {};
    }

    return instance;
  }

  getLocalServer() {
    return `127.0.0.1#${this.config.localPort || 8854}`;
  }

  async prepareConfig(config = {}) {
    this.config = config;
    let content = await fs.readFileAsync(templatePath, {encoding: 'utf8'});
    content = content.replace("%DNSCRYPT_FALLBACK_DNS%", config.fallbackDNS || "1.1.1.1");
    content = content.replace("%DNSCRYPT_LOCAL_PORT%", config.localPort || 8854);
    content = content.replace("%DNSCRYPT_LOCAL_PORT%", config.localPort || 8854);
    content = content.replace("%DNSCRYPT_IPV6%", "false");

    let serverList = await this.getServers();

    content = content.replace("%DNSCRYPT_SERVER_LIST%", JSON.stringify(serverList));

    const allServers = await this.getAllServers();

    content = content.replace("%DNSCRYPT_ALL_SERVER_LIST%", this.allServersToToml(allServers));

    await fs.writeFileAsync(runtimePath, content);
  }

  allServersToToml(servers) {
    return servers.map((s) => {
      if(!s) return null;
      return `[static.'${s.name}']\n  stamp = '${s.stamp}'\n`;
    }).filter(Boolean).join("\n");
  }

  async restart() {
    return exec("sudo systemctl restart dnscrypt");
  }

  async stop() {
    return exec("sudo systemctl stop dnscrypt");
  }

  getDefaultServers() {
    return this.getDefaultAllServers().map(x => x.name);
  }

  async getServers() {
    const serversString = await rclient.getAsync(serverKey);
    if(!serversString) {
      return this.getDefaultServers();
    }

    try {
      const servers = JSON.parse(serversString);
      return servers;
    } catch(err) {
      log.error("Failed to parse servers, err:", err);
      return this.getDefaultServers();
    }
  }

  async setServers(servers) {
    if(servers === null) {
      return rclient.delAsync(serverKey);
    }

    return rclient.setAsync(serverKey, JSON.stringify(servers));
  }

  getDefaultAllServers() {
    const result = require('./defaultServers.json');
    return result && result.servers;
  }

  async getAllServers() {
    const serversString = await rclient.getAsync(allServerKey);
    if(!serversString) {
      return this.getDefaultAllServers();
    }

    try {
      const servers = JSON.parse(serversString);
      return servers;
    } catch(err) {
      log.error("Failed to parse servers, err:", err);
      return this.getDefaultAllServers();
    }
  }

  async getAllServerNames() {
    const all = await this.getAllServers();
    return all.map((x) => x.name).filter(Boolean);
  }

  async setAllServers(servers) {
    if(servers === null) {
      return rclient.delAsync(serverKey);
    }

    return rclient.setAsync(serverKey, JSON.stringify(servers));
  }

}

module.exports = new DNSCrypt();
