import Promise from 'bluebird';
import { Connect } from '@sublimemedia/api-connector';
import { getFromPath, createPath, extend } from '@sublimemedia/wicker-man-utilities';
import WMContent from '@sublimemedia/wicker-man-content';
import WMBee from '@sublimemedia/wicker-man-bee';

const endEvents = ['beforeunload', 'unload'];

function listenerAction() {
  this.exit.call(this);

  endEvents
  .forEach(listener.bind(this, 'removeEventListener'));
}

function listener(funcName, eName) {
  window[funcName](eName, listenerAction.bind(this), false);
}

export default class WMLearning extends WMContent {
  constructor() {
    super();

    this.storeUpResolve = new WMBee();
    this.storeUpReject = new WMBee();
    
    this.store = {};
    this.scoreMeta = {};
    this.observed = {};
    this.storeUpdated = new Promise(function(resolve, reject) {
      this.storeUpResolve.onValue(resolve);
      this.storeUpReject.onValue(reject);
    }.bind(this));

    endEvents
    .forEach(listener.bind(this, 'addEventListener'));
  }

  connect(vocab, apis) {
    this.vocab = vocab;
    this.sco = new Connect(this.vocab, apis);

    this.sco.initialized
    .then(val => this.get('ss'))
    .then(val => {
      if (val) {
        this.store = val;
        this.storeUpResolve.set(val);
      } else {
        this.storeUpReject.set(val);
      }
    })
    .catch(this.storeUpReject.set);

    return this;
  }

  get(prop = '') {
    const storeVal = getFromPath(prop, this.store);

    if (typeof storeVal !== 'undefined') {
      return Promise.resolve(storeVal);
    }

    return this.sco.get(prop);
  }

  set(prop, value) {
    if (typeof prop === 'string') {
      const storeVal = getFromPath(prop, this.store, true);
      let status;

      if (typeof storeVal.value !== 'undefined') {
        const meta = getFromPath(prop, this.scoreMeta),
          test = meta.test && typeof meta.test === 'function' ? meta.test() : true;

        if (test) {
          storeVal.parent[storeVal.key] = value;
        }

        status = Promise[test ? 'resolve' : 'reject']();
      } else {
        status = this.sco.set(prop, value);
      }

      return status.then(function(){
        this.fireObservers(prop, value);
      }.bind(this));
      } else if (typeof prop === 'object') {
      return Promise.all(this, Object.keys(prop)
        .map(function(key) {
          return this.set(key, prop[key]);
        }, this));
    } else {
      return Promise.reject();
    }
  }

  defineScore(score) {
    const prop = score.property;

    if (score && typeof score === 'object' && prop) {
      let newScorePath = createPath(prop, this.scoreMeta);

      extend(true, newScorePath, score);

      this.storeUpdated
      .catch(() => {
        let newStorePath = createPath(prop, this.store, true);

        newStorePath.parent[newStorePath.key] = 0;
      });
    }

    return this;
  }

  getDefinedScore(prop) {
    let score = {
      total: 0,
      completed: 0
    };

    const container = getFromPath(prop, this.store);

    if(typeof container === 'object') {
      score = Object.keys(container)
      .map(key => {
        return this.getDefinedScore(container[key]);
      })
      .reduce((prev, current) => {
        prev.total += 1;

        if (current.total && current.total === current.completed) {
          prev.completed += 1;
        }

        return prev;
      });

    } else if (typeof prop === 'number' || typeof container === 'number') {
      score.total += 1;

      if ((typeof prop === 'number' && prop) ||
        (typeof container === 'number' && container)) {
        score.completed += 1;
      }
    }

    return score;
  }

  updateCompletion() {

    let total = 0,
      completed = 0,
      toSet = [];

    Object.keys(this.store)
    .forEach(key => {
      const scored = this.getDefinedScore(key);

      total += scored.total;
      completed += scored.completed;
    });

    toSet = [
      [ 'ss', this.store ],
      [ 'score', (completed/total) * 100 ],
      [ 'scoreRaw', completed ],
      [ 'scoreMax', total ],
      [ 'scoreMin', 0 ],
      [ 'scoreScaled', (completed/total) ]
    ];

    if (this.location) {
      toSet.push(['location', (typeof this.location === 'function' ? this.location() : this.location)]);
    }
    
    return this.sco.get('lessonStatus')
      .then(function(val) {
        if (val !== this.vocab.completed) {
          const complete = (completed/total) * 100 >= (this.completionThreshold || 100);

          toSet.push([ 'lessonStatus', complete ? this.vocab.completed : this.vocab.incomplete ]);
          toSet.push([ 'successStatus', complete ? this.vocab.passed : this.vocab.failed ]);
        }

        return Promise.all(toSet.map(args => this.sco.set.apply(null, args)));

      }.bind(this));
  }

  exit(e) {
    return this.updateCompletion()
    .then(this.sco.exit)
    .then(() => {
      return 'Course Exited';
    })
    .catch(() => {
      return 'Error Exiting';
    });
  }
}
