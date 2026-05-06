// src/utils/hotelLogic.ts

export const calculateTotal = (roomPrice: number, nights: number, adults: number, children: number): number => {
  const basePrice = roomPrice * nights;
  const childSurcharge = children * 20; // Example: extra charge for children
  return basePrice + childSurcharge;
};

export const validateCapacity = (roomCapacity: number, adults: number, children: number): { isValid: boolean; message: string } => {
  const totalGuests = adults + children;
  if (totalGuests > roomCapacity) {
    return { isValid: false, message: `Capacity exceeded! Max capacity is ${roomCapacity}.` };
  }
  if (totalGuests <= 0) {
    return { isValid: false, message: "Please enter a valid number of guests." };
  }
  return { isValid: true, message: "OK" };
};