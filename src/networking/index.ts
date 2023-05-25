import defaults from './telemetry';
import url from 'url';
import base64 from 'base-64';
import {fetchWithTimeout} from '../utils/fetchWithTimeout';

type RequestOptions = {
  method: any,
  body?: any,
  headers: {
    Accept: string,
    'Content-Type': string,
    'Auth0-Client': string,
    Authorization?: string
  }
}

export default class Client {
  private telemetry: any;
  private baseUrl: string;
  private domain: string;
  private bearer: string;
  private timeout: number;

  constructor(options: { baseUrl: string, telemetry: any, token: string, timeout: number }) {
    const {baseUrl, telemetry = {}, token, timeout = 10000} = options;
    if (!baseUrl) {
      throw new Error('Missing Auth0 domain');
    }
    const {name = defaults.name, version = defaults.version} = telemetry;
    this.telemetry = {name, version};
    if (name !== defaults.name) {
      this.telemetry.env = {};
      this.telemetry.env[defaults.name] = defaults.version;
    }
    const parsed = url.parse(baseUrl);
    this.baseUrl =
      parsed.protocol === 'https:' || parsed.protocol === 'http:'
        ? baseUrl
        : `https://${baseUrl}`;
    this.domain = parsed.hostname || baseUrl;
    if (token) {
      this.bearer = `Bearer ${token}`;
    }

    this.timeout = timeout;
  }

  post(path, body) {
    return this.request('POST', this.url(path), body);
  }

  patch(path, body) {
    return this.request('PATCH', this.url(path), body);
  }

  get(path, query) {
    return this.request('GET', this.url(path, query));
  }

  url(path: string, query?: any, includeTelemetry: boolean = false) {
    let endpoint = url.resolve(this.baseUrl, path);
    if ((query && query.length !== 0) || includeTelemetry) {
      const parsed = url.parse(endpoint);
      parsed.query = query || {};
      if (includeTelemetry) {
        parsed.query.auth0Client = this._encodedTelemetry();
      }
      endpoint = url.format(parsed);
    }
    return endpoint;
  }

  request(method, url, body?: object) {
    const options: RequestOptions = {
      method: method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Auth0-Client': this._encodedTelemetry(),
      },
    };

    if (this.bearer) {
      options.headers.Authorization = this.bearer;
    }
    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetchWithTimeout(url, options, this.timeout).then(response => {
      const payload = {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
      };
      return response
        .json()
        .then(json => {
          return {...payload, json};
        })
        .catch(() => {
          return response
            .text()
            .then(text => {
              return {...payload, text};
            })
            .catch(() => {
              return {...payload, text: response.statusText};
            });
        });
    });
  }

  _encodedTelemetry() {
    return base64.encode(JSON.stringify(this.telemetry));
  }
}
