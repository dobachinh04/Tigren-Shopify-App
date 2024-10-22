import { Page, Card, Button, DataTable } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { GraphQLClient, gql } from "graphql-request";

export default function HomePage() {
  const [products, setProducts] = useState([]);

  const client = new GraphQLClient("/api/graphql", {
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_API_SECRET,
    },
  });

  const fetchProducts = async () => {
    const query = gql`
      {
        products(first: 10) {
          edges {
            node {
              id
              title
              description
              priceRangeV2 {
                maxVariantPrice {
                  amount
                }
              }
            }
          }
        }
      }
    `;

    const data = await client.request(query);
    setProducts(data.products.edges.map(edge => edge.node));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const rows = products.map((product) => [
    product.title,
    product.description,
    `$${product.priceRangeV2.maxVariantPrice.amount}`,
  ]);

  return (
    <Page>
      <Card title="Products" sectioned>
        <DataTable
          columnContentTypes={["text", "text", "text"]}
          headings={["Title", "Description", "Price"]}
          rows={rows}
        />
      </Card>
    </Page>
  );
}
