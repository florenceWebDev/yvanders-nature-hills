export type Slot = { id: string; label: string; start: string; end: string };
export type Offering = {
 id: string; slug: string; name: string; kind: 'room'|'camping'|'pavilion'|'day-use'; description: string;
 images: string[]; amenities: string[]; published: boolean; resource_id: string; allocation_basis: 'unit'|'guest';
 max_guests: number; price: number; price_basis: 'night'|'unit'|'guest'; deposit_percent: number;
 schedule: 'overnight'|'slots'; check_in: string; check_out: string; slots: Slot[];
};
export type Settings = {tagline:string;intro:string;contact:string;email:string;address:string;qr_url:string;payment_recipient:string;payment_instructions:string;payment_ready:boolean;cancellation_policy:string;faq?:{question:string;answer:string}[]};
export type Booking = {id:string;reference:string;user_id:string;guest_email:string;guest_name:string;phone:string;offering_id:string;offering_name:string;starts_at:string;ends_at:string;guests:number;units:number;total:number;deposit:number;paid:number;status:string;expires_at:string;created_at:string;admin_note:string;refund_note?:string;snapshot:{payment:Settings};receipts?:{id:string;object_path:string;transaction_reference:string;created_at:string}[]};
export type Resource = {id:string;name:string;capacity:number};
export type Quote = {starts_at:string;ends_at:string;allocation:number;total:number;deposit:number;available:boolean;remaining:number;name:string;nights:number;deposit_percent:number};
