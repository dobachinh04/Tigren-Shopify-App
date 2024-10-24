import React, { useState, useEffect, useCallback } from 'react';
import { Page, Card, DataTable, TextField, Button, Layout } from '@shopify/polaris';
import { useLoaderData } from '@remix-run/react';
import { apiVersion, authenticate } from '../shopify.server';

// Query GraphQL để lấy danh sách customers
export const query = `
  {
  customers(first: 10) {
    edges {
      node {
        id
        firstName
        lastName
        email
        phone
        numberOfOrders
        amountSpent {
          amount
          currencyCode
        }
      }
    }
  }
}
`;

// Loader để gọi API Shopify Admin GraphQL
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  try {
    const response = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/graphql",
        "X-Shopify-Access-Token": accessToken,
      },
      body: query,
    });

    if (response.ok) {
      const data = await response.json();
      const customers = data.data.customers.edges;
      return customers;
    } else {
      console.error('Failed to fetch customers:', response.statusText);
    }
  } catch (err) {
    console.error('Error fetching customers:', err);
  }
};


// Component chính
function App() {
  const customersData = useLoaderData();
  const [customers, setCustomers] = useState([]);
  const [editPoints, setEditPoints] = useState({});
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Khởi tạo dữ liệu khách hàng từ loader
  useEffect(() => {
    const customerList = customersData.map(({ node }) => ({
      id: node.id,
      name: `${node.firstName} ${node.lastName}`,
      email: node.email,
      orders: node.ordersCount,
      amountSpent: node.totalSpent,
      points: 0, // Giá trị mặc định
    }));
    setCustomers(customerList);
  }, [customersData]);

  // const handleEditPoints = useCallback((id, newPoints) => {
  //   setCustomers((prev) =>
  //     prev.map((customer) =>
  //       customer.id === id ? { ...customer, points: newPoints } : customer
  //     )
  //   );
  //   setSelectedCustomerId(null);
  // }, []);

  // const renderEditForm = (id, currentPoints) => (
  //   <Layout>
  //     <Layout.Section>
  //       <TextField
  //         label="Reward Points"
  //         type="number"
  //         value={editPoints[id] || currentPoints.toString()}
  //         onChange={(value) => setEditPoints({ ...editPoints, [id]: value })}
  //       />
  //     </Layout.Section>
  //     <Layout.Section>
  //       <Button
  //         onClick={() =>
  //           handleEditPoints(id, parseInt(editPoints[id] || currentPoints, 10))
  //         }
  //       >
  //         Save
  //       </Button>
  //     </Layout.Section>
  //   </Layout>
  // );

  const rows = customers.map((customer) => [
    customer.name,
    customer.email,
    customer.orders,
    customer.amountSpent,
    customer.points.toString(),
    selectedCustomerId === customer.id ? (
      renderEditForm(customer.id, customer.points)
    ) : (
      <Button onClick={() => setSelectedCustomerId(customer.id)}>Edit</Button>
    ),
  ]);

  return (
    <Page title="Customers Reward Points">
      <Card>
        {customers.length > 0 ? (
          <DataTable
            columnContentTypes={['text', 'text', 'numeric', 'text', 'numeric', 'text']}
            headings={['Customer Name', 'Email', 'Orders', 'Amount Spent', 'Reward Points', 'Actions']}
            rows={rows}
          />
        ) : (
          <p>No customers available.</p>
        )}
      </Card>
    </Page>
  );
}

export default App;
