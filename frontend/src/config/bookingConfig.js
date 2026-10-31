/**
 * Centralized Booking Configuration for CARZODRIVE
 * Standardizes pickup/drop locations and service categories
 */

export const BHUBANESWAR_LOCATIONS = [
  'SUM Hospital',
  'Fire Station',
  'IIIT Gothapatana',
  'DN Regalia Square',
  'Khandagiri',
  'Kalinga Nagar',
  'Jayadev Vatika',
  'Biju Patnaik Airport (BBI)',
  'Bhubaneswar Railway Station',
  'Patia / KIIT Square',
  'Jayadev Vihar',
  'Saheed Nagar',
  'Rasulgarh Square',
  'Baramunda Bus Stand',
  'Cuttack Link Road',
];

export const SERVICE_OPTIONS = [
  {
    id: 'self-drive-car',
    label: 'Self-Drive Car',
    tagline: 'Rent and drive yourself with complete freedom & privacy',
    type: 'car',
  },
  {
    id: 'car-with-driver',
    label: 'Car with Driver',
    tagline: 'Executive luxury car with vetted driver',
    type: 'chauffeur',
  },
  {
    id: 'driver-only',
    label: 'Driver Only',
    tagline: 'Hire verified commercial driver for your own car',
    type: 'driver',
  },
  {
    id: 'self-drive-bike',
    label: 'Self-Drive Bike',
    tagline: 'Cruisers, sportbikes & city scooters with helmets',
    type: 'bike',
  },
  {
    id: 'tour-packages',
    label: 'Tour Packages',
    tagline: 'Curated Odisha holiday tours (Puri, Konark, Chilika)',
    type: 'tour',
  },
];
