module.exports = class Store {
  static _data = new Map();

  /**
   * @static
   * @param {string} key
   * @param {object} subsriberObject
   * @memberof Store
   */
  static onChange(key, subsriberObject) {
    if (!this._data.has(key)) {
      this._data.set(key, { value: null, SOs: [] });
    }
    this._data.get(key).SOs.push(subsriberObject);
  }

  /**
   * @static
   * @param {String} key
   * @param {*} value
   * @memberof Store
   */
  static set(key, value) {
    if (this._data.has(key)) {
      const data = this._data.get(key);
      data.value = value;
      data.SOs.forEach(SO => SO.update({ key: key, value: value }));
    } else {
      this._data.set(key, { value: value, SOs: [] });
    }
  }
};
