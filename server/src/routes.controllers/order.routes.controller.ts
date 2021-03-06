import { Request, Response } from "express";
import { User } from "../controllers/User/User";
import { UserRepository } from "../controllers/User/User.repository";
import { OrdersPackRepository } from "../controllers/OrdersPack/OrdersPack.repository";
import { Order } from "../controllers/Order/Order";
import { OrderBuilder } from "../controllers/Order/Order.builder";
import { OrderRepository } from "../controllers/Order/Order.repository";
import { OrdersPack } from "../controllers/OrdersPack/OrdersPack";
import { Ref } from "@typegoose/typegoose";
import { NextFunction } from "connect";
import { ExpressError } from "../controllers/ErrorControllers/ExpressError";
import { ErrorCodes } from "../controllers/ErrorControllers/ErrorCodeEnum";

/**
 * Clase que contiene los métodos relacionados a Order para ser accedidos
 * mediante un API.
 */
export class OrderRoutesController{

    /**
     * Crea una Orden dentro de un OrdersPack especificado para un Usuario especificado.
     * @param req Request
     * @param res Response
     */
    public static async createOrder(req: Request, res: Response, next: NextFunction){
        const {ordersPack_id, description, price, user_id, paymentMethod, payed} =  req.body;
        const user: User = await UserRepository.findById(user_id);
        const ordersPack: OrdersPack =  await OrdersPackRepository.findById(ordersPack_id);

        if(OrderRoutesController.canPlaceOrder(user, ordersPack, user_id)){
            const order: Order = new OrderBuilder(description, price, user_id)
                                              .setPaymentMethod(paymentMethod)
                                              .setPayed(payed)
                                              .build();

            const savedOrder: Order = await OrderRepository.save(order);
            await OrdersPackRepository.addOrder(savedOrder, ordersPack_id);
            await UserRepository.addOrder(user, savedOrder);

            res.send({order: savedOrder});
        } else {
            return next(new ExpressError("there was an error placing your order.", ErrorCodes.GENERIC_ERROR, 400));
        }
    }

    /**
     * Retorna si user puede agregar una order nueva a ordersPack o no.
     * @param user Usuario que quiere crear una Orden.
     * @param ordersPack OrdersPack donde se quiere agregar la Orden.
     * @param user_id Id del Usuario que quiere crear la Orden.
     */
    private static canPlaceOrder(user: User, ordersPack: OrdersPack, user_id: Ref<User>): boolean{
        return ( 
            user &&
            ordersPack &&
            ordersPack.expirationDate > new Date() &&
            !OrderRoutesController.hasPlacedOrder(user_id, ordersPack));
    }

    /**
     * Retorna si un usuario con el id user_id ha agregado una Orden a ordersPack.
     * @param user_id Id del usuario que se quiere comprobar si ha agregado una Orden.
     * @param ordersPack OrdersPack en el cual se quiere hacer la verificacion.
     */
    private static hasPlacedOrder(user_id: Ref<User>, ordersPack: OrdersPack): boolean{
        for(let orderRef of ordersPack.orders){
            let order: Order = orderRef as Order;
            if((<User> order.user_id)._id == user_id){
                return true;
            }
        }

        return false;
    }

    /**
     * Edita la informacion correspondiente a una Orden.
     * @param req Request
     * @param res Response
     */
    public static async editOrder(req: Request, res: Response, next: NextFunction):Promise<void>{
        const {order_id, ordersPack_id, description, payed, price, paymentMethod, user_id} =  req.body;
        const ordersPack: OrdersPack = await OrdersPackRepository.findById(ordersPack_id);
        const order: Order = await OrderRepository.findById(order_id);

        if(OrderRoutesController.canEditOrder(order, ordersPack, user_id)){
            const updated = await OrderRepository.editOrderInformation(order, description, paymentMethod, payed, price);
            res.sendStatus(200);
            return;
        }
        return next(new ExpressError("there was an error updating the requested resource", ErrorCodes.GENERIC_UPDATE_ERROR, 400));
    }

    /**
     * Retorna si el usuario que hizo la peticion de editar la orden puede editar la orden o no.
     * @param order Orden que se quiere editar.
     * @param ordersPack OrdersPack al que pertenece order.
     * @param user_id Id de quien quiere editar la orden.
     */
    private static canEditOrder(order: Order, ordersPack: OrdersPack, user_id: Ref<User>): boolean{
        return(
            ordersPack &&
            ordersPack.expirationDate > new Date() &&
            order &&
            order.user_id == user_id
        );
    }

    /**
     * Elimina una Orden y todas sus referencias de la base de datos.
     * @param req Request
     * @param res Response
     */
    public static async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void>{
        const {order_id, ordersPack_id, user_id} = req.body;
        const ordersPack: OrdersPack = await OrdersPackRepository.findById(ordersPack_id);
        const order: Order = await OrderRepository.findById(order_id);

        if(OrderRoutesController.canEditOrder(order, ordersPack, user_id)){
            await UserRepository.deleteOrderFromUser(user_id, order_id);
            await OrdersPackRepository.deleteOrder(order_id, ordersPack_id);
            await OrderRepository.delete(order_id);
            res.sendStatus(200);
            return;
        }
        return next(new ExpressError("there was an error deleting the requested resource", ErrorCodes.GENERIC_DELETE_ERROR, 400));
    }
}