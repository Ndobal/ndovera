import React from 'react';
import './Loader.css';

const Loader = () => (
  <div className="loader-container">
    <div className="spinner spinner-merged">
      <img src={process.env.PUBLIC_URL + '/ndovera logo.svg'} className="loader-logo loader-logo-center" alt="Ndovera Logo" />
    </div>
  </div>
);

export default Loader;
