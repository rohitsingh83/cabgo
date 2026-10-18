import type { Place } from '@/types';

/**
 * Well-known Hyderabad places. They power:
 *  • the "popular places" shortcuts in the search dropdown, and
 *  • a fully working booking flow in development before a Google Maps key is configured.
 */
export const DEMO_PLACES: readonly Place[] = [
  { name: 'Charminar', address: 'Charminar, Char Kaman, Ghansi Bazaar, Hyderabad, Telangana 500002', lat: 17.3616, lng: 78.4747 },
  { name: 'HITEC City', address: 'HITEC City, Madhapur, Hyderabad, Telangana 500081', lat: 17.4435, lng: 78.3772 },
  { name: 'Gachibowli', address: 'Gachibowli, Hyderabad, Telangana 500032', lat: 17.4401, lng: 78.3489 },
  { name: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad, Telangana 500034', lat: 17.4126, lng: 78.4482 },
  { name: 'Jubilee Hills Check Post', address: 'Jubilee Hills Check Post, Hyderabad, Telangana 500033', lat: 17.4326, lng: 78.4071 },
  { name: 'Secunderabad Railway Station', address: 'Secunderabad Junction, Hyderabad, Telangana 500003', lat: 17.4337, lng: 78.5013 },
  { name: 'Rajiv Gandhi International Airport', address: 'Rajiv Gandhi International Airport, Shamshabad, Hyderabad, Telangana 500409', lat: 17.2403, lng: 78.4294 },
  { name: 'Hussain Sagar Lake', address: 'Necklace Road, Hussain Sagar, Hyderabad, Telangana 500080', lat: 17.4239, lng: 78.4738 },
  { name: 'Kukatpally Housing Board', address: 'KPHB Colony, Kukatpally, Hyderabad, Telangana 500072', lat: 17.4849, lng: 78.3915 },
  { name: 'Begumpet Airport Road', address: 'Begumpet, Hyderabad, Telangana 500016', lat: 17.4399, lng: 78.4637 },
];
