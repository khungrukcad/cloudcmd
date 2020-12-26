const {parse, stringify} = JSON;

export const set = async (name, data) => {
    localStorage.setItem(name, data);
};

export const setJson = async (name, data) => {
    localStorage.setItem(name, stringify(data));
};

export const get = async (name) => {
    return localStorage.getItem(name);
};

export const getJson = async (name) => {
    const data = localStorage.getItem(name);
    return parse(data);
};

export const clear = () => {
    localStorage.clear();
};

export const remove = (item) => {
    localStorage.removeItem(item);
};

