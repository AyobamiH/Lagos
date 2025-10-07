import React from 'react';
import { MapPicker } from './MapPicker';

export default { title: 'Components/MapPicker', component: MapPicker };

export const Basic = () => (
  <div style={{height:400}}>
    <MapPicker pickup={{lat:37.7749,lng:-122.4194}} dropoff={{lat:37.7849,lng:-122.4094}} onChange={()=>{}} />
  </div>
);
