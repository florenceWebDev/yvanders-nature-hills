import{Account}from'@/components/account';
export const metadata={title:'Your bookings',robots:{index:false,follow:false}};
export default function Page(){return <main id="main" className="section account-section"><h1 className="sr-only">Your guest account and bookings</h1><Account/></main>;}
