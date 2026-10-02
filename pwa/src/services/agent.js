// 54Bank PWA — Agent conversation service (W12-A4-P0-E: created — app.js
// imported this module but it did not exist, so the entire PWA failed to
// build).
//
// Implements exactly what app.js uses:
//   agentService.subscribe(cb)   (app.js:57)  — cb fired on every change
//   agentService.getHistory()    (app.js:58)  — conversation list, shape:
//     { id, agentType, question, status: 'thinking'|'complete'|'error',
//       steps?, result?, error?, startTime }
//     (rendered at app.js:364-380, :404-435, :613-637)
//   agentService.ask(q, agentType?) (app.js:921, :933) — posts the question
//     to the matching agent microservice through the APISIX gateway prefix
//     /agent-<id>/* (e.g. agent-nl-reporting-py serves POST /v1/agent/ask
//     with {query, context} and returns {steps, result, ...}); without an
//     explicit agent the unified chat defaults to 'nl-reporting'.
// History is persisted to localStorage (the settings page counts cached
// completed queries, app.js:881).

import { api } from './api.js';

const HISTORY_KEY = '54bank_agent_history';
const DEFAULT_AGENT = 'nl-reporting';
const MAX_HISTORY = 100;

class AgentService {
  constructor() {
    this._listeners = [];
    try {
      this._history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      // A reload can orphan an in-flight 'thinking' entry — mark it errored.
      this._history.forEach((c) => {
        if (c.status === 'thinking') {
          c.status = 'error';
          c.error = 'Interrupted by page reload';
        }
      });
    } catch (e) {
      this._history = [];
    }
  }

  subscribe(listener) {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  _emit(event) {
    this._listeners.forEach((l) => {
      try { l(event); } catch (e) { console.error('[agent] listener error', e); }
    });
  }

  _persist() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this._history.slice(-MAX_HISTORY)));
    } catch (e) {
      // storage full — history stays in memory only
    }
  }

  getHistory() {
    return this._history;
  }

  async ask(question, agentType) {
    const agent = agentType || DEFAULT_AGENT;
    const convo = {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentType: agent,
      question: String(question),
      status: 'thinking',
      startTime: Date.now(),
    };
    this._history.push(convo);
    if (this._history.length > MAX_HISTORY) this._history = this._history.slice(-MAX_HISTORY);
    this._emit({ type: 'started', conversation: convo });

    try {
      const data = await api.request('POST', `/agent-${agent}/v1/agent/ask`, {
        query: convo.question,
        context: {},
      });
      convo.status = 'complete';
      convo.steps = data && data.steps;
      convo.result = data && data.result !== undefined ? data.result : data;
      convo.endTime = Date.now();
    } catch (err) {
      convo.status = 'error';
      convo.error = err && err.message ? err.message : String(err);
      convo.endTime = Date.now();
    }
    this._persist();
    this._emit({ type: 'updated', conversation: convo });
    return convo;
  }
}

export const agentService = new AgentService();
